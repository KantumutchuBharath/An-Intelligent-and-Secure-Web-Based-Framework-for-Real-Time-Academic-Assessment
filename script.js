const STORAGE_KEY = "onlineQuizAppData";
let quizTimerInterval = null;
let warningTimeout = null;

const defaultData = {
    users: [],
    admins: [
        {
            id: "admin-1",
            username: "admin",
            password: "admin123",
            name: "Quiz Administrator"
        }
    ],
    tests: [
        {
            id: "test-history",
            title: "World History Challenge",
            category: "History",
            description: "A short history test with five questions.",
            durationMinutes: 10,
            maxAttemptsPerUser: 2,
            availableUntil: null,
            isAnswerKeyReleased: false,
            questions: [
                {
                    id: "history-q1",
                    text: "Who was the first President of the United States?",
                    options: ["George Washington", "Abraham Lincoln", "Thomas Jefferson", "John Adams"],
                    answerIndex: 0,
                    explanation: "George Washington became the first U.S. President in 1789 after leading the Continental Army."
                },
                {
                    id: "history-q2",
                    text: "In which year did World War II end?",
                    options: ["1942", "1945", "1939", "1950"],
                    answerIndex: 1,
                    explanation: "World War II ended in 1945 after Germany surrendered in May and Japan surrendered in September."
                },
                {
                    id: "history-q3",
                    text: "Which country hosted the 2016 Summer Olympics?",
                    options: ["China", "Brazil", "Japan", "South Africa"],
                    answerIndex: 1,
                    explanation: "Rio de Janeiro in Brazil hosted the 2016 Summer Olympics."
                },
                {
                    id: "history-q4",
                    text: "In which year did humans first land on the moon?",
                    options: ["1965", "1969", "1972", "1975"],
                    answerIndex: 1,
                    explanation: "Apollo 11 landed on the moon in 1969, with Neil Armstrong and Buzz Aldrin walking on the surface."
                },
                {
                    id: "history-q5",
                    text: "Which river is traditionally taught as the longest in the world?",
                    options: ["Amazon", "Yangtze", "Mississippi", "Nile"],
                    answerIndex: 3,
                    explanation: "The Nile is commonly taught as the longest river in standard quiz material."
                }
            ]
        },
        {
            id: "test-science",
            title: "Science Essentials",
            category: "Science",
            description: "Core science questions across chemistry, astronomy, and biology.",
            durationMinutes: 8,
            maxAttemptsPerUser: 3,
            availableUntil: null,
            isAnswerKeyReleased: false,
            questions: [
                {
                    id: "science-q1",
                    text: "Which planet is known as the Red Planet?",
                    options: ["Mars", "Venus", "Jupiter", "Saturn"],
                    answerIndex: 0,
                    explanation: "Mars appears reddish because of iron oxide, or rust, on its surface."
                },
                {
                    id: "science-q2",
                    text: "What is the chemical formula for water?",
                    options: ["H2O", "CO2", "NaCl", "O2"],
                    answerIndex: 0,
                    explanation: "A water molecule contains two hydrogen atoms and one oxygen atom, so its formula is H2O."
                },
                {
                    id: "science-q3",
                    text: "Which element has the chemical symbol O?",
                    options: ["Oxygen", "Gold", "Iron", "Helium"],
                    answerIndex: 0,
                    explanation: "The chemical symbol O stands for oxygen on the periodic table."
                },
                {
                    id: "science-q4",
                    text: "Which organ is primarily responsible for detoxification?",
                    options: ["Kidneys", "Stomach", "Liver", "Lungs"],
                    answerIndex: 2,
                    explanation: "The liver processes toxins, drugs, and waste products, making it the main detoxification organ."
                },
                {
                    id: "science-q5",
                    text: "What is the hardest natural substance on Earth?",
                    options: ["Iron", "Gold", "Diamond", "Quartz"],
                    answerIndex: 2,
                    explanation: "Diamond is the hardest naturally occurring substance on the Mohs hardness scale."
                }
            ]
        }
    ],
    attempts: [],
    session: {
        userId: null,
        adminId: null,
        activeTestId: null,
        activeTestStartedAt: null,
        activeQuestionIndex: 0,
        activeViolationCount: 0,
        visitedQuestionIds: []
    }
};

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeData(data) {
    data.tests = (data.tests || []).map(test => ({
        ...test,
        category: test.category || test.title,
        durationMinutes: Number(test.durationMinutes) > 0 ? Number(test.durationMinutes) : 10,
        maxAttemptsPerUser: Number(test.maxAttemptsPerUser) > 0 ? Number(test.maxAttemptsPerUser) : 1,
        availableUntil: test.availableUntil || null,
        isAnswerKeyReleased: Boolean(test.isAnswerKeyReleased),
        questions: (test.questions || []).map(question => ({
            ...question,
            explanation: question.explanation || "No explanation provided for this question yet."
        }))
    }));

    data.attempts = (data.attempts || []).map(attempt => ({
        ...attempt,
        answers: attempt.answers || [],
        autoSubmitted: Boolean(attempt.autoSubmitted),
        timeSpentSeconds: Number(attempt.timeSpentSeconds) > 0 ? Number(attempt.timeSpentSeconds) : 0
    }));

    data.session = {
        ...deepClone(defaultData.session),
        ...(data.session || {})
    };

    data.session.visitedQuestionIds = data.session.visitedQuestionIds || [];

    return data;
}

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
        const seeded = normalizeData(deepClone(defaultData));
        saveData(seeded);
        return seeded;
    }

    const parsed = JSON.parse(stored);
    const merged = normalizeData({
        ...deepClone(defaultData),
        ...parsed,
        session: {
            ...deepClone(defaultData.session),
            ...(parsed.session || {})
        }
    });

    saveData(merged);
    return merged;
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentPage() {
    return document.body.dataset.page || "";
}

function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function setMessage(elementId, message, type) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `status-message ${type || ""}`.trim();
}

function formatDate(value) {
    return new Date(value).toLocaleString();
}

function formatDuration(minutes) {
    return `${minutes} min`;
}

function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatExpiry(test) {
    if (!test.availableUntil) {
        return "No expiry";
    }

    const remaining = new Date(test.availableUntil).getTime() - Date.now();
    if (remaining <= 0) {
        return "Expired";
    }

    return `Expires in ${Math.ceil(remaining / 60000)} min`;
}

function getTestById(data, testId) {
    return data.tests.find(test => test.id === testId);
}

function getAttemptById(data, attemptId) {
    return data.attempts.find(attempt => attempt.id === attemptId);
}

function getAttemptsForUserAndTest(data, userId, testId) {
    return data.attempts.filter(attempt => attempt.userId === userId && attempt.testId === testId);
}

function findUserByUsername(data, username) {
    return data.users.find(user => user.username.toLowerCase() === username.toLowerCase());
}

function isTestExpired(test) {
    return Boolean(test.availableUntil) && new Date(test.availableUntil).getTime() <= Date.now();
}

function canUserStartTest(data, user, test) {
    const attempts = getAttemptsForUserAndTest(data, user.id, test.id).length;

    if (isTestExpired(test)) {
        return { allowed: false, reason: "This test has expired." };
    }

    if (attempts >= test.maxAttemptsPerUser) {
        return { allowed: false, reason: "You have reached the maximum number of attempts for this test." };
    }

    return { allowed: true, reason: "" };
}

function getReleaseStatusMarkup(isReleased) {
    return isReleased
        ? '<span class="badge badge-correct">Answer Key Released</span>'
        : '<span class="badge badge-pending">Answer Key Hidden</span>';
}

function loginUser(event) {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const data = loadData();
    const user = data.users.find(
        item => item.username.toLowerCase() === username.toLowerCase() && item.password === password
    );

    if (!user) {
        setMessage("loginMessage", "Invalid username or password.", "error");
        return false;
    }

    data.session.userId = user.id;
    data.session.adminId = null;
    saveData(data);
    window.location.href = "dashboard.html";
    return false;
}

function registerUser(event) {
    event.preventDefault();

    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const fullName = document.getElementById("fullName").value.trim();
    const data = loadData();

    if (password !== confirmPassword) {
        setMessage("registerMessage", "Passwords do not match.", "error");
        return false;
    }

    if (findUserByUsername(data, username)) {
        setMessage("registerMessage", "That username is already taken.", "error");
        return false;
    }

    const user = {
        id: createId("user"),
        username,
        password,
        fullName: fullName || username,
        createdAt: new Date().toISOString()
    };

    data.users.push(user);
    data.session.userId = user.id;
    data.session.adminId = null;
    saveData(data);
    window.location.href = "dashboard.html";
    return false;
}

function loginAdmin(event) {
    event.preventDefault();

    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;
    const data = loadData();
    const admin = data.admins.find(
        item => item.username.toLowerCase() === username.toLowerCase() && item.password === password
    );

    if (!admin) {
        setMessage("adminLoginMessage", "Invalid admin credentials.", "error");
        return false;
    }

    data.session.adminId = admin.id;
    data.session.userId = null;
    saveData(data);
    window.location.href = "admin-dashboard.html";
    return false;
}

function resetActiveTestSession(data) {
    data.session.activeTestId = null;
    data.session.activeTestStartedAt = null;
    data.session.activeQuestionIndex = 0;
    data.session.activeViolationCount = 0;
    data.session.visitedQuestionIds = [];
}

function logoutUser() {
    const data = loadData();
    resetActiveTestSession(data);
    data.session.userId = null;
    saveData(data);
    window.location.href = "login.html";
}

function logoutAdmin() {
    const data = loadData();
    data.session.adminId = null;
    saveData(data);
    window.location.href = "admin-login.html";
}

function requireUserSession() {
    const data = loadData();
    const user = data.users.find(item => item.id === data.session.userId);

    if (!user) {
        window.location.href = "login.html";
        return null;
    }

    return { data, user };
}

function requireAdminSession() {
    const data = loadData();
    const admin = data.admins.find(item => item.id === data.session.adminId);

    if (!admin) {
        window.location.href = "admin-login.html";
        return null;
    }

    return { data, admin };
}

function startQuiz(testId) {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    const { data, user } = session;
    const test = getTestById(data, testId);
    const permission = canUserStartTest(data, user, test);

    if (!permission.allowed) {
        alert(permission.reason);
        return;
    }

    data.session.activeTestId = testId;
    data.session.activeTestStartedAt = new Date().toISOString();
    data.session.activeQuestionIndex = 0;
    data.session.activeViolationCount = 0;
    data.session.visitedQuestionIds = [];
    saveData(data);
    window.location.href = "quiz.html";
}

function openAttemptReview(attemptId) {
    window.location.href = `review.html?attemptId=${encodeURIComponent(attemptId)}`;
}

function openTestAnswerKey(testId) {
    window.location.href = `answer-key.html?testId=${encodeURIComponent(testId)}`;
}

function openAdminUserReport(userId) {
    window.location.href = `admin-user-report.html?userId=${encodeURIComponent(userId)}`;
}

function getRemainingTimeMs(test, startedAt) {
    return new Date(startedAt).getTime() + (test.durationMinutes * 60000) - Date.now();
}

function collectQuizAnswers(test) {
    const answerMap = {};

    test.questions.forEach(question => {
        const selected = document.querySelector(`input[name="question-${question.id}"]:checked`);
        answerMap[question.id] = selected ? Number(selected.value) : null;
    });

    return answerMap;
}

function finalizeAttempt(data, user, test, answerMap, autoSubmitted) {
    let score = 0;
    const answers = [];
    const startedAt = data.session.activeTestStartedAt;
    const elapsedSeconds = startedAt
        ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
        : 0;

    test.questions.forEach(question => {
        const selectedIndex = Object.prototype.hasOwnProperty.call(answerMap, question.id)
            ? answerMap[question.id]
            : null;

        answers.push({ questionId: question.id, selectedIndex });

        if (selectedIndex === question.answerIndex) {
            score += 1;
        }
    });

    const attempt = {
        id: createId("attempt"),
        userId: user.id,
        testId: test.id,
        score,
        total: test.questions.length,
        percentage: Math.round((score / test.questions.length) * 100),
        answers,
        autoSubmitted: Boolean(autoSubmitted),
        timeSpentSeconds: elapsedSeconds,
        takenAt: new Date().toISOString()
    };

    data.attempts.push(attempt);
    resetActiveTestSession(data);
    saveData(data);
    return attempt;
}

function handleQuizSubmission(autoSubmitted) {
    const session = requireUserSession();
    if (!session) {
        return false;
    }

    const { data, user } = session;
    const test = getTestById(data, data.session.activeTestId);

    if (!test) {
        window.location.href = "dashboard.html";
        return false;
    }

    const attempt = finalizeAttempt(data, user, test, collectQuizAnswers(test), autoSubmitted);
    window.location.href = `result.html?attemptId=${encodeURIComponent(attempt.id)}`;
    return false;
}

function showWarning(message) {
    const banner = document.getElementById("warningBanner");

    if (!banner) {
        return;
    }

    clearTimeout(warningTimeout);
    banner.textContent = message;
    banner.classList.add("show");
    warningTimeout = setTimeout(() => banner.classList.remove("show"), 2000);
}

function goToQuestion(index) {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const test = getTestById(data, data.session.activeTestId);
    const question = test ? test.questions[index] : null;
    data.session.activeQuestionIndex = index;
    if (question && !data.session.visitedQuestionIds.includes(question.id)) {
        data.session.visitedQuestionIds.push(question.id);
    }
    saveData(data);
    renderQuestionPanels();
}

function renderQuestionPanels() {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const test = getTestById(data, data.session.activeTestId);
    const currentIndex = data.session.activeQuestionIndex || 0;
    const cards = Array.from(document.querySelectorAll(".question-card"));
    const navButtons = Array.from(document.querySelectorAll(".question-nav-btn"));

    cards.forEach((card, index) => {
        card.hidden = index !== currentIndex;
    });

    navButtons.forEach((button, index) => {
        const question = test.questions[index];
        const answered = Boolean(document.querySelector(`input[name="question-${question.id}"]:checked`));
        const visited = data.session.visitedQuestionIds.includes(question.id);

        button.classList.toggle("active", index === currentIndex);
        button.classList.toggle("completed", answered);
        button.classList.toggle("pending", visited && !answered);
        button.classList.toggle("not-visited", !visited && !answered);
    });

    const counter = document.getElementById("questionCounter");
    if (counter) {
        counter.textContent = `Question ${currentIndex + 1} of ${cards.length}`;
    }

    renderQuestionActions(cards.length, currentIndex);
}

function renderQuestionActions(totalQuestions, currentIndex) {
    const actions = document.getElementById("questionActions");
    if (!actions) {
        return;
    }

    const previousMarkup = currentIndex > 0
        ? `<button type="button" class="nav-arrow" data-nav="prev" aria-label="Previous question">&larr;</button>`
        : `<span class="nav-arrow nav-arrow-placeholder"></span>`;

    const nextMarkup = currentIndex < totalQuestions - 1
        ? `<button type="button" class="nav-arrow" data-nav="next" aria-label="Next question">&rarr;</button>`
        : `<button type="submit" class="btn" form="quizForm">Submit Quiz</button>`;

    actions.innerHTML = `
        <div class="question-actions-left">${previousMarkup}</div>
        <div class="question-actions-right">${nextMarkup}</div>
    `;

    const prevButton = actions.querySelector('[data-nav="prev"]');
    const nextButton = actions.querySelector('[data-nav="next"]');

    if (prevButton) {
        prevButton.addEventListener("click", () => goToQuestion(currentIndex - 1));
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => goToQuestion(currentIndex + 1));
    }
}

function mountQuestionNavigation(test) {
    const nav = document.getElementById("questionNavigation");
    nav.innerHTML = "";

    test.questions.forEach((question, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "question-nav-btn not-visited";
        button.textContent = String(index + 1);
        button.addEventListener("click", () => goToQuestion(index));
        nav.appendChild(button);
    });

    renderQuestionPanels();
}

function requestQuizFullscreen() {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
        return;
    }

    document.documentElement.requestFullscreen().catch(() => undefined);
}

function mountQuizSecurity(data, user, test) {
    const startedAt = data.session.activeTestStartedAt;

    function autoSubmit(reason) {
        clearInterval(quizTimerInterval);
        showWarning(reason);

        const latestData = loadData();
        const latestUser = latestData.users.find(item => item.id === user.id);
        const latestTest = getTestById(latestData, test.id);

        if (!latestUser || !latestTest || latestData.session.activeTestId !== test.id) {
            return;
        }

        const attempt = finalizeAttempt(latestData, latestUser, latestTest, collectQuizAnswers(latestTest), true);
        window.location.href = `result.html?attemptId=${encodeURIComponent(attempt.id)}`;
    }

    function handleVisibilityChange() {
        if (document.visibilityState !== "hidden") {
            return;
        }

        const latestData = loadData();
        latestData.session.activeViolationCount += 1;
        saveData(latestData);

        if (latestData.session.activeViolationCount > 2) {
            autoSubmit("You switched tabs too many times. The test is being auto-submitted.");
        }
    }

    function handleFocus() {
        const latestData = loadData();
        const count = latestData.session.activeViolationCount;

        if (count > 0 && count <= 2 && latestData.session.activeTestId === test.id) {
            showWarning(`Warning ${count} of 2: tab switching was detected.`);
        }
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement && loadData().session.activeTestId === test.id) {
            autoSubmit("You exited fullscreen mode. The test is being auto-submitted.");
        }
    }

    function tick() {
        const remainingMs = getRemainingTimeMs(test, startedAt);
        const timer = document.getElementById("quizTimer");
        const note = document.getElementById("quizTimerNote");

        if (remainingMs <= 0) {
            timer.textContent = "00:00";
            note.textContent = "Time is over. Auto-submitting now.";
            autoSubmit("Time is over. The test is being auto-submitted.");
            return;
        }

        timer.textContent = formatRemaining(remainingMs);
        note.textContent = "Stay in fullscreen. More than 2 tab switches will auto-submit.";
    }

    clearInterval(quizTimerInterval);
    tick();
    quizTimerInterval = setInterval(tick, 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    window.addEventListener("beforeunload", () => {
        clearInterval(quizTimerInterval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, { once: true });
}

function renderQuizPage() {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    const { data, user } = session;
    const test = getTestById(data, data.session.activeTestId);

    if (!test) {
        window.location.href = "dashboard.html";
        return;
    }

    const permission = canUserStartTest(data, user, test);
    if (!permission.allowed) {
        alert(permission.reason);
        resetActiveTestSession(data);
        saveData(data);
        window.location.href = "dashboard.html";
        return;
    }

    document.getElementById("quizTitle").textContent = test.title;
    document.getElementById("quizDescription").textContent = test.description;
    document.getElementById("quizMeta").textContent = `${test.questions.length} questions - ${formatDuration(test.durationMinutes)} - max ${test.maxAttemptsPerUser} attempts`;

    const form = document.getElementById("quizForm");
    form.innerHTML = "";

    test.questions.forEach((question, index) => {
        const wrapper = document.createElement("section");
        wrapper.className = "question-card";
        wrapper.hidden = true;
                wrapper.innerHTML = `
            <div class="question-head">
                <span class="question-number">Question ${index + 1}</span>
                <h3>${question.text}</h3>
            </div>
            <div class="choice-list">
                ${question.options.map((option, optionIndex) => `
                    <label class="choice">
                        <input type="radio" name="question-${question.id}" value="${optionIndex}">
                        <span>${option}</span>
                    </label>
                `).join("")}
            </div>
        `;
        form.appendChild(wrapper);
    });

    form.addEventListener("change", renderQuestionPanels);
    mountQuestionNavigation(test);
    if (!data.session.visitedQuestionIds.includes(test.questions[data.session.activeQuestionIndex || 0].id)) {
        data.session.visitedQuestionIds.push(test.questions[data.session.activeQuestionIndex || 0].id);
        saveData(data);
    }
    renderQuestionPanels();
    mountQuizSecurity(data, user, test);
    requestQuizFullscreen();
}

function submitQuiz(event) {
    event.preventDefault();
    return handleQuizSubmission(false);
}

function buildUserStats(data, user) {
    const attempts = data.attempts.filter(attempt => attempt.userId === user.id);
    const distinctTests = new Set(attempts.map(attempt => attempt.testId));
    const totalMarks = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
    const totalPossible = attempts.reduce((sum, attempt) => sum + attempt.total, 0);

    return [
        { label: "Tests Available", value: data.tests.length },
        { label: "Tests Attempted", value: distinctTests.size },
        { label: "Total Marks Scored", value: `${totalMarks}${totalPossible ? ` / ${totalPossible}` : ""}` },
        { label: "Attempts Used", value: attempts.length }
    ];
}

function renderStats(containerId, stats) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.innerHTML = stats.map(stat => `
        <article class="stat-card">
            <span class="stat-label">${stat.label}</span>
            <strong>${stat.value}</strong>
        </article>
    `).join("");
}

function buildLeaderboardRows(data, filterTestId) {
    if (filterTestId === "overall") {
        return data.users
            .map(user => {
                const attempts = data.attempts.filter(attempt => attempt.userId === user.id);
                if (!attempts.length) {
                    return null;
                }

                const average = Math.round(attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / attempts.length);
                return {
                    label: user.fullName || user.username,
                    score: `${average}% avg`,
                    attempts: attempts.length
                };
            })
            .filter(Boolean)
            .sort((first, second) => parseInt(second.score, 10) - parseInt(first.score, 10));
    }

    return data.users
        .map(user => {
            const attempts = data.attempts.filter(
                attempt => attempt.userId === user.id && attempt.testId === filterTestId
            );

            if (!attempts.length) {
                return null;
            }

            const best = attempts.reduce((top, current) => current.percentage > top.percentage ? current : top);
            return {
                label: user.fullName || user.username,
                score: `${best.score}/${best.total} (${best.percentage}%)`,
                attempts: attempts.length
            };
        })
        .filter(Boolean)
        .sort((first, second) => {
            const secondScore = Number(second.score.match(/\((\d+)%\)/)?.[1] || 0);
            const firstScore = Number(first.score.match(/\((\d+)%\)/)?.[1] || 0);
            return secondScore - firstScore;
        });
}

function populateTestFilter(selectId, data, overallLabel) {
    const select = document.getElementById(selectId);
    if (!select) {
        return;
    }

    const currentValue = select.value || "overall";
    select.innerHTML = `<option value="overall">${overallLabel}</option>`;
    data.tests.forEach(test => {
        const option = document.createElement("option");
        option.value = test.id;
        option.textContent = test.title;
        select.appendChild(option);
    });
    select.value = data.tests.some(test => test.id === currentValue) || currentValue === "overall"
        ? currentValue
        : "overall";
}

function renderLeaderboard(tableBodyId, data, filterTestId) {
    const body = document.getElementById(tableBodyId);
    if (!body) {
        return;
    }

    const rows = buildLeaderboardRows(data, filterTestId);
    body.innerHTML = "";

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="4">No leaderboard data available yet.</td></tr>`;
        return;
    }

    rows.forEach((rowData, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${rowData.label}</td>
            <td>${rowData.score}</td>
            <td>${rowData.attempts}</td>
        `;
        body.appendChild(row);
    });
}

function renderUserDashboard() {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    const { data, user } = session;
    document.getElementById("dashboardWelcome").textContent = `Welcome, ${user.fullName || user.username}`;
    renderStats("userStats", buildUserStats(data, user));

    const testsContainer = document.getElementById("testsContainer");
    testsContainer.innerHTML = "";

    data.tests.forEach(test => {
        const attemptsUsed = getAttemptsForUserAndTest(data, user.id, test.id).length;
        const permission = canUserStartTest(data, user, test);
        const card = document.createElement("div");
        card.className = "card elevated-card";
        card.innerHTML = `
            <div class="card-chip">${permission.allowed ? "Available" : "Locked"}</div>
            <h3>${test.title}</h3>
            <p>${test.description}</p>
            <p class="muted">${test.questions.length} questions - ${formatDuration(test.durationMinutes)}</p>
            <p class="muted">Attempts used: ${attemptsUsed}/${test.maxAttemptsPerUser} - ${formatExpiry(test)}</p>
            <div class="card-foot">
                ${getReleaseStatusMarkup(test.isAnswerKeyReleased)}
                <button class="btn" type="button" ${permission.allowed ? "" : "disabled"}>${permission.allowed ? "Start Test" : "Unavailable"}</button>
            </div>
        `;

        const button = card.querySelector("button");
        if (permission.allowed) {
            button.addEventListener("click", () => startQuiz(test.id));
        }

        testsContainer.appendChild(card);
    });

    const attemptsBody = document.getElementById("attemptsBody");
    attemptsBody.innerHTML = "";

    const attempts = data.attempts
        .filter(attempt => attempt.userId === user.id)
        .sort((first, second) => new Date(second.takenAt) - new Date(first.takenAt));

    if (!attempts.length) {
        attemptsBody.innerHTML = `<tr><td colspan="5">No tests taken yet.</td></tr>`;
    } else {
        attempts.forEach(attempt => {
            const test = getTestById(data, attempt.testId);
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${test ? test.title : "Deleted Test"}</td>
                <td>${attempt.score}/${attempt.total}</td>
                <td>${attempt.percentage}%</td>
                <td>${formatDate(attempt.takenAt)}</td>
                <td>${test && test.isAnswerKeyReleased
                    ? `<button type="button" class="btn btn-secondary btn-small" data-attempt-id="${attempt.id}">Review</button>`
                    : `<span class="badge badge-pending">Hidden until release</span>`
                }</td>
            `;

            const button = row.querySelector("button");
            if (button) {
                button.addEventListener("click", () => openAttemptReview(attempt.id));
            }

            attemptsBody.appendChild(row);
        });
    }

    populateTestFilter("userLeaderboardFilter", data, "Overall Leaderboard");
    renderLeaderboard("userLeaderboardBody", data, document.getElementById("userLeaderboardFilter").value || "overall");
}

function getAdminProgressRows(data, filterTestId) {
    if (filterTestId === "overall") {
        return data.users.map(user => {
            const attempts = data.attempts.filter(attempt => attempt.userId === user.id);

            if (!attempts.length) {
                return {
                    test: "Overall",
                    student: user.fullName || user.username,
                    attempts: 0,
                    best: "-",
                    latest: "-",
                    status: "Not started"
                };
            }

            const best = attempts.reduce((top, current) => current.percentage > top.percentage ? current : top);
            const latest = attempts.reduce((recent, current) =>
                new Date(current.takenAt) > new Date(recent.takenAt) ? current : recent
            );

            return {
                test: "Overall",
                student: user.fullName || user.username,
                attempts: attempts.length,
                best: `${best.score}/${best.total} (${best.percentage}%)`,
                latest: formatDate(latest.takenAt),
                status: latest.percentage >= 80 ? "Strong" : latest.percentage >= 50 ? "In progress" : "Needs review"
            };
        });
    }

    const test = data.tests.find(item => item.id === filterTestId);
    if (!test) {
        return [];
    }

    return data.users.map(user => {
        const attempts = getAttemptsForUserAndTest(data, user.id, test.id);

        if (!attempts.length) {
            return {
                test: test.title,
                student: user.fullName || user.username,
                attempts: 0,
                best: "-",
                latest: "-",
                status: "Not started"
            };
        }

        const best = attempts.reduce((top, current) => current.percentage > top.percentage ? current : top);
        const latest = attempts.reduce((recent, current) =>
            new Date(current.takenAt) > new Date(recent.takenAt) ? current : recent
        );

        return {
            test: test.title,
            student: user.fullName || user.username,
            attempts: attempts.length,
            best: `${best.score}/${best.total} (${best.percentage}%)`,
            latest: formatDate(latest.takenAt),
            status: latest.percentage >= 80 ? "Strong" : latest.percentage >= 50 ? "In progress" : "Needs review"
        };
    });
}

function renderAdminProgress(data, filterTestId) {
    const body = document.getElementById("studentProgressBody");
    if (!body) {
        return;
    }

    const rows = getAdminProgressRows(data, filterTestId);
    body.innerHTML = "";

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="6">No student data available.</td></tr>`;
        return;
    }

    rows.forEach(rowData => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${rowData.test}</td>
            <td>${rowData.student}</td>
            <td>${rowData.attempts}</td>
            <td>${rowData.best}</td>
            <td>${rowData.latest}</td>
            <td>${rowData.status}</td>
        `;
        body.appendChild(row);
    });
}

function buildAdminStats(data) {
    return [
        { label: "Students", value: data.users.length },
        { label: "Tests", value: data.tests.length },
        { label: "Attempts", value: data.attempts.length },
        { label: "Keys Released", value: data.tests.filter(test => test.isAnswerKeyReleased).length }
    ];
}

function renderAdminDashboard() {
    const session = requireAdminSession();
    if (!session) {
        return;
    }

    const { data, admin } = session;
    document.getElementById("adminWelcome").textContent = `Welcome, ${admin.name}`;
    renderStats("adminStats", buildAdminStats(data));

    populateTestFilter("adminLeaderboardFilter", data, "Overall Leaderboard");
    populateTestFilter("progressTestFilter", data, "Overall Student Progress");
    renderLeaderboard("leaderboardBody", data, document.getElementById("adminLeaderboardFilter").value || "overall");
    renderAdminProgress(data, document.getElementById("progressTestFilter").value || "overall");

    const select = document.getElementById("testSelect");
    select.innerHTML = `<option value=\"\">Create New Test</option>`;
    data.tests.forEach(test => {
        const option = document.createElement("option");
        option.value = test.id;
        option.textContent = test.title;
        select.appendChild(option);
    });

    const list = document.getElementById("adminTestList");
    list.innerHTML = "";

    data.tests.forEach(test => {
        const attempts = data.attempts.filter(attempt => attempt.testId === test.id).length;
        const item = document.createElement("div");
        item.className = "card compact elevated-card";
        item.innerHTML = `
            <div class="card-chip subtle">${test.isAnswerKeyReleased ? "Released" : "Hidden"}</div>
            <h3>${test.title}</h3>
            <p>${test.description}</p>
            <p class="muted">${test.questions.length} questions - ${formatDuration(test.durationMinutes)} - ${attempts} attempts</p>
            <p class="muted">Attempts allowed: ${test.maxAttemptsPerUser} - ${formatExpiry(test)}</p>
            <div class="card-foot card-foot-admin">
                <button type="button" class="btn btn-secondary btn-small" data-action="edit">Edit</button>
                <button type="button" class="btn btn-secondary btn-small" data-action="key">Answer Key</button>
                <button type="button" class="btn btn-small" data-action="toggle">${test.isAnswerKeyReleased ? "Hide Key" : "Release Key"}</button>
                <button type="button" class="btn btn-danger btn-small" data-action="delete">Delete</button>
            </div>
        `;

        item.querySelector('[data-action="edit"]').addEventListener("click", () => {
            document.getElementById("testSelect").value = test.id;
            loadTestIntoEditor();
        });
        item.querySelector('[data-action="key"]').addEventListener("click", () => openTestAnswerKey(test.id));
        item.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleAnswerKeyRelease(test.id));
        item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteTestById(test.id));
        list.appendChild(item);
    });

    if (!document.getElementById("testId").value && !document.querySelector(".question-editor-card")) {
        addQuestionEditor();
    }
}

function renderAdminUserList(data, searchTerm) {
    const list = document.getElementById("adminUsersList");
    const count = document.getElementById("adminUsersCount");
    if (!list || !count) {
        return;
    }

    const query = (searchTerm || "").trim().toLowerCase();
    const users = data.users
        .filter(user => {
            const name = `${user.fullName || ""} ${user.username || ""}`.toLowerCase();
            return name.includes(query);
        })
        .sort((first, second) => (first.fullName || first.username).localeCompare(second.fullName || second.username));

    count.textContent = `${users.length} user${users.length === 1 ? "" : "s"}`;
    list.innerHTML = "";

    if (!users.length) {
        list.innerHTML = `<div class="insight-card">No users found.</div>`;
        return;
    }

    users.forEach(user => {
        const attempts = data.attempts.filter(attempt => attempt.userId === user.id);
        const latest = attempts.length
            ? attempts.reduce((recent, current) => new Date(current.takenAt) > new Date(recent.takenAt) ? current : recent)
            : null;
        const average = attempts.length
            ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / attempts.length)
            : 0;

        const card = document.createElement("button");
        card.type = "button";
        card.className = "card user-report-card elevated-card";
        card.innerHTML = `
            <span class="card-chip">${attempts.length ? "Report Ready" : "No Attempts"}</span>
            <strong>${user.fullName || user.username}</strong>
            <span class="muted">@${user.username}</span>
            <span class="muted">${attempts.length} attempt${attempts.length === 1 ? "" : "s"} - ${average}% average</span>
            <span class="muted">Latest: ${latest ? formatDate(latest.takenAt) : "No tests taken"}</span>
        `;
        card.addEventListener("click", () => openAdminUserReport(user.id));
        list.appendChild(card);
    });
}

function renderAdminUsersPage() {
    const session = requireAdminSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const search = document.getElementById("adminUserSearch");
    renderAdminUserList(data, search ? search.value : "");

    if (search) {
        search.addEventListener("input", () => renderAdminUserList(data, search.value));
    }
}

function loadTestIntoEditor() {
    const session = requireAdminSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const test = getTestById(data, document.getElementById("testSelect").value);

    document.getElementById("testId").value = test ? test.id : "";
    document.getElementById("testTitle").value = test ? test.title : "";
    document.getElementById("testCategory").value = test ? test.category : "";
    document.getElementById("testDescription").value = test ? test.description : "";
    document.getElementById("testDuration").value = test ? test.durationMinutes : 10;
    document.getElementById("testAttempts").value = test ? test.maxAttemptsPerUser : 1;
    document.getElementById("testExpiryMinutes").value = test && test.availableUntil
        ? Math.max(0, Math.ceil((new Date(test.availableUntil).getTime() - Date.now()) / 60000))
        : "";
    const builder = document.getElementById("questionBuilder");
    builder.innerHTML = "";

    if (test) {
        test.questions.forEach(question => addQuestionEditor(question));
    } else {
        addQuestionEditor();
    }

    setMessage("adminTestMessage", test ? "Editing existing test." : "Creating a new test.", "success");
}

function addQuestionEditor(question) {
    const builder = document.getElementById("questionBuilder");
    if (!builder) {
        return;
    }

    const item = document.createElement("div");
    item.className = "question-editor-card";
    item.innerHTML = `
        <div class="panel-header compact-header">
            <h4 class="question-editor-title">Question</h4>
            <button type="button" class="btn btn-danger btn-small" data-remove-question>Remove</button>
        </div>
        <input type="text" class="qe-text" placeholder="Question text" value="${question ? question.text.replace(/"/g, "&quot;") : ""}">
        <div class="question-editor-grid">
            <input type="text" class="qe-option" placeholder="Option 1" value="${question ? question.options[0].replace(/"/g, "&quot;") : ""}">
            <input type="text" class="qe-option" placeholder="Option 2" value="${question ? question.options[1].replace(/"/g, "&quot;") : ""}">
            <input type="text" class="qe-option" placeholder="Option 3" value="${question ? question.options[2].replace(/"/g, "&quot;") : ""}">
            <input type="text" class="qe-option" placeholder="Option 4" value="${question ? question.options[3].replace(/"/g, "&quot;") : ""}">
        </div>
        <select class="qe-answer">
            <option value="">Select correct option</option>
            <option value="0" ${question && question.answerIndex === 0 ? "selected" : ""}>Option 1</option>
            <option value="1" ${question && question.answerIndex === 1 ? "selected" : ""}>Option 2</option>
            <option value="2" ${question && question.answerIndex === 2 ? "selected" : ""}>Option 3</option>
            <option value="3" ${question && question.answerIndex === 3 ? "selected" : ""}>Option 4</option>
        </select>
        <textarea class="qe-explanation" rows="3" placeholder="Answer explanation">${question ? question.explanation : ""}</textarea>
    `;

    item.querySelector("[data-remove-question]").addEventListener("click", () => {
        item.remove();
        refreshQuestionEditorTitles();
    });

    builder.appendChild(item);
    refreshQuestionEditorTitles();
}

function refreshQuestionEditorTitles() {
    document.querySelectorAll(".question-editor-card").forEach((card, index) => {
        const title = card.querySelector(".question-editor-title");
        if (title) {
            title.textContent = `Question ${index + 1}`;
        }
    });
}

function collectQuestionEditorValues() {
    const cards = Array.from(document.querySelectorAll(".question-editor-card"));

    if (!cards.length) {
        throw new Error("Please add at least one question.");
    }

    return cards.map((card, index) => {
        const text = card.querySelector(".qe-text").value.trim();
        const options = Array.from(card.querySelectorAll(".qe-option")).map(input => input.value.trim());
        const answerIndex = Number(card.querySelector(".qe-answer").value);
        const explanation = card.querySelector(".qe-explanation").value.trim();

        if (!text || options.some(option => !option)) {
            throw new Error(`Question ${index + 1} needs a question and all four options.`);
        }

        if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
            throw new Error(`Question ${index + 1} needs a selected correct answer.`);
        }

        if (!explanation) {
            throw new Error(`Question ${index + 1} needs an explanation.`);
        }

        return {
            id: createId("question"),
            text,
            options,
            answerIndex,
            explanation
        };
    });
}

function saveTest(event) {
    event.preventDefault();

    const session = requireAdminSession();
    if (!session) {
        return false;
    }

    const { data } = session;
    const testId = document.getElementById("testId").value;
    const title = document.getElementById("testTitle").value.trim();
    const category = document.getElementById("testCategory").value.trim();
    const description = document.getElementById("testDescription").value.trim();
    const durationMinutes = Number(document.getElementById("testDuration").value);
    const maxAttemptsPerUser = Number(document.getElementById("testAttempts").value);
    const expiryMinutes = Number(document.getElementById("testExpiryMinutes").value);
    if (!title || !category || !description) {
        setMessage("adminTestMessage", "Title, category, and description are required.", "error");
        return false;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        setMessage("adminTestMessage", "Enter a valid duration.", "error");
        return false;
    }

    if (!Number.isFinite(maxAttemptsPerUser) || maxAttemptsPerUser <= 0) {
        setMessage("adminTestMessage", "Enter a valid attempt limit.", "error");
        return false;
    }

    try {
        const questions = collectQuestionEditorValues();
        const existing = getTestById(data, testId);
        const nextTest = {
            id: testId || createId("test"),
            title,
            category,
            description,
            durationMinutes,
            maxAttemptsPerUser,
            availableUntil: Number.isFinite(expiryMinutes) && expiryMinutes > 0
                ? new Date(Date.now() + (expiryMinutes * 60000)).toISOString()
                : null,
            isAnswerKeyReleased: existing ? existing.isAnswerKeyReleased : false,
            questions
        };

        const existingIndex = data.tests.findIndex(test => test.id === nextTest.id);
        if (existingIndex >= 0) {
            data.tests[existingIndex] = nextTest;
        } else {
            data.tests.push(nextTest);
        }

        saveData(data);
        renderAdminDashboard();
        document.getElementById("testSelect").value = nextTest.id;
        loadTestIntoEditor();
        setMessage("adminTestMessage", "Test saved successfully.", "success");
    } catch (error) {
        setMessage("adminTestMessage", error.message, "error");
    }

    return false;
}

function deleteTest() {
    const testId = document.getElementById("testId").value;
    if (!testId) {
        setMessage("adminTestMessage", "Select a test to delete.", "error");
        return;
    }

    deleteTestById(testId);
}

function deleteTestById(testId) {
    const session = requireAdminSession();
    if (!session) {
        return;
    }

    const { data } = session;
    data.tests = data.tests.filter(test => test.id !== testId);
    data.attempts = data.attempts.filter(attempt => attempt.testId !== testId);

    if (data.session.activeTestId === testId) {
        resetActiveTestSession(data);
    }

    saveData(data);
    const form = document.getElementById("testForm");
    if (form) {
        form.reset();
        document.getElementById("testId").value = "";
    }
    renderAdminDashboard();
    setMessage("adminTestMessage", "Test deleted successfully.", "success");
}

function toggleAnswerKeyRelease(testId) {
    const session = requireAdminSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const test = getTestById(data, testId);
    if (!test) {
        return;
    }

    test.isAnswerKeyReleased = !test.isAnswerKeyReleased;
    saveData(data);

    if (getCurrentPage() === "admin-dashboard") {
        renderAdminDashboard();
        document.getElementById("testSelect").value = test.id;
        loadTestIntoEditor();
    }
}

function buildQuestionReviewCard(question, savedAnswer, showUserChoice) {
    const selectedIndex = savedAnswer ? savedAnswer.selectedIndex : null;
    const isCorrect = selectedIndex === question.answerIndex;

    return `
        <article class="review-card">
            <h3>${question.text}</h3>
            ${showUserChoice ? `<p class="review-status ${isCorrect ? "success" : "error"}">${isCorrect ? "You answered this correctly." : "You missed this question."}</p>` : ""}
            <ul class="review-list">
                ${question.options.map((option, index) => {
                    const classes = ["review-option"];
                    if (index === question.answerIndex) {
                        classes.push("correct");
                    }
                    if (showUserChoice && selectedIndex === index) {
                        classes.push("selected");
                    }
                    if (showUserChoice && selectedIndex === index && index !== question.answerIndex) {
                        classes.push("wrong");
                    }

                    let badge = "";
                    if (index === question.answerIndex) {
                        badge = '<span class="badge badge-correct">Correct Answer</span>';
                    } else if (showUserChoice && selectedIndex === index) {
                        badge = '<span class="badge badge-wrong">Your Choice</span>';
                    }

                    return `<li class="${classes.join(" ")}"><span>${option}</span>${badge}</li>`;
                }).join("")}
            </ul>
            <div class="explanation-box">
                <strong>Explanation</strong>
                <p>${question.explanation}</p>
            </div>
        </article>
    `;
}

function renderResultPage() {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const attempt = getAttemptById(data, getQueryParam("attemptId"));
    if (!attempt) {
        window.location.href = "dashboard.html";
        return;
    }

    const test = getTestById(data, attempt.testId);
    document.getElementById("resultTitle").textContent = test ? test.title : "Quiz Result";
    document.getElementById("resultScore").textContent = `${attempt.score}/${attempt.total}`;
    document.getElementById("resultPercentage").textContent = `${attempt.percentage}%`;
    document.getElementById("resultDate").textContent = formatDate(attempt.takenAt);
    document.getElementById("resultFeedback").textContent = attempt.autoSubmitted
        ? "The test was auto-submitted because time or security rules were triggered."
        : "Your answers have been saved successfully.";
    document.getElementById("resultReleaseNote").textContent = test && test.isAnswerKeyReleased
        ? "Answer key is available now."
        : "Answer key is hidden until the admin releases it.";

    const button = document.getElementById("reviewAttemptButton");
    button.disabled = !(test && test.isAnswerKeyReleased);
    if (test && test.isAnswerKeyReleased) {
        button.addEventListener("click", () => openAttemptReview(attempt.id));
    }
}

function renderReviewPage() {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const attempt = getAttemptById(data, getQueryParam("attemptId"));
    if (!attempt) {
        window.location.href = "dashboard.html";
        return;
    }

    const test = getTestById(data, attempt.testId);
    if (!test || !test.isAnswerKeyReleased) {
        window.location.href = "dashboard.html";
        return;
    }

    document.getElementById("reviewTitle").textContent = `${test.title} Review`;
    document.getElementById("reviewSummary").textContent = `Score ${attempt.score}/${attempt.total} - ${attempt.percentage}% - ${formatDate(attempt.takenAt)}`;
    document.getElementById("reviewContainer").innerHTML = test.questions.map(question => {
        const answer = attempt.answers.find(item => item.questionId === question.id);
        return buildQuestionReviewCard(question, answer, true);
    }).join("");
}

function renderAnswerKeyPage() {
    const session = requireAdminSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const test = getTestById(data, getQueryParam("testId"));
    if (!test) {
        window.location.href = "admin-dashboard.html";
        return;
    }

    document.getElementById("answerKeyTitle").textContent = `${test.title} Answer Key`;
    document.getElementById("answerKeySummary").textContent = `${test.questions.length} questions - ${formatDuration(test.durationMinutes)} - ${test.isAnswerKeyReleased ? "Released to users" : "Hidden from users"}`;

    const releaseButton = document.getElementById("releaseKeyButton");
    releaseButton.textContent = test.isAnswerKeyReleased ? "Hide Key From Users" : "Release Key To Users";
    releaseButton.onclick = () => {
        toggleAnswerKeyRelease(test.id);
        window.location.reload();
    };

    document.getElementById("answerKeyContainer").innerHTML = test.questions
        .map(question => buildQuestionReviewCard(question, null, false))
        .join("");
}

function formatSeconds(seconds) {
    if (!seconds) {
        return "0m";
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

function buildChartCard(title, subtitle, content) {
    return `
        <article class="chart-card">
            <div class="chart-card-head">
                <h3>${title}</h3>
                <p class="muted">${subtitle}</p>
            </div>
            <div class="chart-card-body">${content}</div>
        </article>
    `;
}

function buildPieChartSvg(correct, wrong, unanswered) {
    const total = Math.max(1, correct + wrong + unanswered);
    const circumference = 2 * Math.PI * 54;
    const values = [
        { value: correct, color: "#1c7c54", label: "Correct" },
        { value: wrong, color: "#c74444", label: "Wrong" },
        { value: unanswered, color: "#d9902f", label: "Unanswered" }
    ];

    let offset = 0;
    const segments = values.map(item => {
        const length = (item.value / total) * circumference;
        const segment = `
            <circle
                cx="80"
                cy="80"
                r="54"
                fill="none"
                stroke="${item.color}"
                stroke-width="18"
                stroke-dasharray="${length} ${circumference - length}"
                stroke-dashoffset="${-offset}"
                transform="rotate(-90 80 80)"
                stroke-linecap="round"
            />
        `;
        offset += length;
        return segment;
    }).join("");

    return `
        <div class="chart-wrap">
            <svg viewBox="0 0 160 160" class="chart-svg">
                <circle cx="80" cy="80" r="54" fill="none" stroke="#f0e7dd" stroke-width="18"></circle>
                ${segments}
                <text x="80" y="78" text-anchor="middle" class="chart-center-value">${Math.round((correct / total) * 100)}%</text>
                <text x="80" y="98" text-anchor="middle" class="chart-center-label">Correct</text>
            </svg>
            <div class="chart-legend">
                ${values.map(item => `<div class="legend-item"><span class="legend-dot" style="background:${item.color}"></span>${item.label}: ${item.value}</div>`).join("")}
            </div>
        </div>
    `;
}

function buildLineChartSvg(points) {
    if (!points.length) {
        return `<p class="muted">No attempts yet.</p>`;
    }

    const width = 420;
    const height = 220;
    const padding = 24;
    const stepX = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);
    const coords = points.map((point, index) => {
        const x = padding + (stepX * index);
        const y = height - padding - ((point.value / 100) * (height - padding * 2));
        return { x, y, label: point.label, value: point.value };
    });

    const polyline = coords.map(point => `${point.x},${point.y}`).join(" ");

    return `
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg wide">
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis-line"></line>
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="axis-line"></line>
            <polyline fill="none" stroke="#d96b3b" stroke-width="4" points="${polyline}"></polyline>
            ${coords.map(point => `
                <circle cx="${point.x}" cy="${point.y}" r="5" fill="#a74824"></circle>
                <text x="${point.x}" y="${point.y - 10}" text-anchor="middle" class="point-label">${point.value}%</text>
            `).join("")}
        </svg>
    `;
}

function buildBarChartSvg(items, formatter) {
    if (!items.length) {
        return `<p class="muted">No category performance data yet.</p>`;
    }

    const max = Math.max(...items.map(item => item.value), 1);
    return `
        <div class="bar-chart">
            ${items.map(item => `
                <div class="bar-row">
                    <div class="bar-meta">
                        <span>${item.label}</span>
                        <strong>${formatter(item.value)}</strong>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width:${(item.value / max) * 100}%"></div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

function renderReportForUser(data, user, options) {
    const settings = {
        isAdminView: false,
        ...options
    };
    const attempts = data.attempts
        .filter(attempt => attempt.userId === user.id)
        .sort((first, second) => new Date(first.takenAt) - new Date(second.takenAt));

    document.getElementById("reportWelcome").textContent = `${user.fullName || user.username}'s Report`;
    document.getElementById("reportSubtitle").textContent = attempts.length
        ? `${settings.isAdminView ? "Read-only admin view based on" : "Analytics based on"} ${attempts.length} quiz attempt${attempts.length > 1 ? "s" : ""}.`
        : settings.isAdminView
            ? "This user has not submitted any quiz attempts yet."
            : "Take a quiz to generate your performance report.";

    if (!attempts.length) {
        renderStats("reportStats", [
            { label: "Attempts", value: 0 },
            { label: "Average Score", value: "0%" },
            { label: "Average Time", value: "0m" },
            { label: "Categories", value: 0 }
        ]);
        document.getElementById("reportCharts").innerHTML = buildChartCard(
            "No Data Yet",
            settings.isAdminView ? "No quiz attempts have been submitted by this user." : "Start attempting quizzes to unlock charts.",
            `<p class="muted">${settings.isAdminView ? "There is no report data to review yet." : "Your report will appear here after your first attempt."}</p>`
        );
        document.getElementById("reportInsights").innerHTML = `<div class="insight-card">${settings.isAdminView ? "No insights are available for this user yet." : "No insights yet. Attempt a quiz to generate analytics."}</div>`;
        return;
    }

    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    attempts.forEach(attempt => {
        const test = getTestById(data, attempt.testId);
        if (!test) {
            return;
        }

        test.questions.forEach(question => {
            const answer = attempt.answers.find(item => item.questionId === question.id);
            if (!answer || answer.selectedIndex === null) {
                unanswered += 1;
            } else if (answer.selectedIndex === question.answerIndex) {
                correct += 1;
            } else {
                wrong += 1;
            }
        });
    });

    const averageScore = Math.round(attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / attempts.length);
    const averageTime = Math.round(attempts.reduce((sum, attempt) => sum + (attempt.timeSpentSeconds || 0), 0) / attempts.length);
    const categoryMap = new Map();

    attempts.forEach(attempt => {
        const test = getTestById(data, attempt.testId);
        if (!test) {
            return;
        }

        const current = categoryMap.get(test.category) || { total: 0, count: 0 };
        current.total += attempt.percentage;
        current.count += 1;
        categoryMap.set(test.category, current);
    });

    const categoryPerformance = Array.from(categoryMap.entries()).map(([label, value]) => ({
        label,
        value: Math.round(value.total / value.count)
    }));

    const timeByQuiz = attempts.map(attempt => ({
        label: getTestById(data, attempt.testId)?.title || "Quiz",
        value: attempt.timeSpentSeconds || 0
    }));

    renderStats("reportStats", [
        { label: "Attempts", value: attempts.length },
        { label: "Average Score", value: `${averageScore}%` },
        { label: "Average Time", value: formatSeconds(averageTime) },
        { label: "Categories", value: categoryPerformance.length }
    ]);

    const linePoints = attempts.map((attempt, index) => ({
        label: `Attempt ${index + 1}`,
        value: attempt.percentage
    }));

    document.getElementById("reportCharts").innerHTML = [
        buildChartCard("Question Accuracy", "Correct vs wrong vs unanswered", buildPieChartSvg(correct, wrong, unanswered)),
        buildChartCard("Score Progress", "How your scores change across attempts", buildLineChartSvg(linePoints)),
        buildChartCard("Category Performance", "Average performance by subject/category", buildBarChartSvg(categoryPerformance, value => `${value}%`)),
        buildChartCard("Time Analysis", "Average time per quiz and quiz-wise timing", `
            <div class="time-analysis">
                <div class="time-summary">
                    <div><span class="stat-label">Average time per quiz</span><strong>${formatSeconds(averageTime)}</strong></div>
                    <div><span class="stat-label">Estimated time per question</span><strong>${formatSeconds(Math.round(averageTime / Math.max(1, attempts.reduce((sum, attempt) => sum + attempt.total, 0) / attempts.length)))}</strong></div>
                </div>
                ${buildBarChartSvg(timeByQuiz, value => formatSeconds(value))}
            </div>
        `)
    ].join("");

    const firstHalf = attempts.slice(0, Math.max(1, Math.floor(attempts.length / 2)));
    const secondHalf = attempts.slice(Math.max(1, Math.floor(attempts.length / 2)));
    const firstAvg = Math.round(firstHalf.reduce((sum, attempt) => sum + attempt.percentage, 0) / firstHalf.length);
    const secondAvg = Math.round(secondHalf.reduce((sum, attempt) => sum + attempt.percentage, 0) / secondHalf.length);
    const weakest = categoryPerformance.slice().sort((a, b) => a.value - b.value)[0];
    const slowThreshold = attempts.reduce((sum, attempt) => sum + ((getTestById(data, attempt.testId)?.durationMinutes || 0) * 60), 0) / attempts.length;

    const insights = [
        secondAvg >= firstAvg ? "Your performance is improving over time." : "Your recent scores are fluctuating. A focused revision may help.",
        weakest ? `Your weakest subject is ${weakest.label}.` : "You do not have enough category data yet.",
        averageTime > slowThreshold * 0.75 ? "You are taking more time than average on quizzes." : "Your quiz completion speed looks efficient."
    ];

    document.getElementById("reportInsights").innerHTML = insights
        .map(text => `<div class="insight-card">${text}</div>`)
        .join("");
}

function renderStudentReportPage() {
    const session = requireUserSession();
    if (!session) {
        return;
    }

    renderReportForUser(session.data, session.user);
}

function renderAdminUserReportPage() {
    const session = requireAdminSession();
    if (!session) {
        return;
    }

    const { data } = session;
    const user = data.users.find(item => item.id === getQueryParam("userId"));
    if (!user) {
        window.location.href = "admin-users.html";
        return;
    }

    renderReportForUser(data, user, { isAdminView: true });
}

function resetDemoData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(deepClone(defaultData))));
    window.location.href = getCurrentPage().includes("admin") ? "admin-login.html" : "login.html";
}

function initializePage() {
    loadData();
    const page = getCurrentPage();

    if (page === "dashboard") {
        renderUserDashboard();
    }

    if (page === "quiz") {
        renderQuizPage();
    }

    if (page === "admin-dashboard") {
        renderAdminDashboard();
    }

    if (page === "admin-users") {
        renderAdminUsersPage();
    }

    if (page === "admin-user-report") {
        renderAdminUserReportPage();
    }

    if (page === "result") {
        renderResultPage();
    }

    if (page === "review") {
        renderReviewPage();
    }

    if (page === "answer-key") {
        renderAnswerKeyPage();
    }

    if (page === "report") {
        renderStudentReportPage();
    }
}

document.addEventListener("DOMContentLoaded", initializePage);

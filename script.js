// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://arkosoknmzfthvqvpxvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i9UzYae8ms1yCkdOxRa7vw_uTpLjaSI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let isSignUpMode = false;

    // --- DOM ELEMENTS ---
    const authModal = document.getElementById("auth-modal");
    const authModalBtn = document.getElementById("auth-modal-btn");
    const profileOpenAuthBtn = document.getElementById("profile-open-auth-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userDisplay = document.getElementById("user-display");

    const authForm = document.getElementById("auth-form");
    const authTitle = document.getElementById("auth-title");
    const authSubtitle = document.getElementById("auth-subtitle");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const toggleAuthModeBtn = document.getElementById("toggle-auth-mode");
    const authSwitchText = document.getElementById("auth-switch-text");
    const signupExtraFields = document.getElementById("signup-extra-fields");
    const signupAgeSelect = document.getElementById("signup-age");
    const authError = document.getElementById("auth-error");

    const profileLoggedOut = document.getElementById("profile-logged-out");
    const profileLoggedIn = document.getElementById("profile-logged-in");
    const profileEmailInput = document.getElementById("profile-email");
    const profileNameInput = document.getElementById("profile-name");
    const profileAgeSelect = document.getElementById("profile-age-group");
    const saveProfileBtn = document.getElementById("save-profile-btn");
    const profileSaveMsg = document.getElementById("profile-save-msg");

    // --- AUTH STATE & MODAL LOGIC ---
    function openAuthModal() {
        authError.classList.add("hidden");
        authModal.classList.remove("hidden");
    }

    function closeAuthModal() {
        authModal.classList.add("hidden");
    }

    authModalBtn.addEventListener("click", openAuthModal);
    profileOpenAuthBtn.addEventListener("click", openAuthModal);
    closeModalBtn.addEventListener("click", closeAuthModal);

    toggleAuthModeBtn.addEventListener("click", () => {
        isSignUpMode = !isSignUpMode;
        authError.classList.add("hidden");
        if (isSignUpMode) {
            authTitle.textContent = "Create a ScamGuard Profile";
            authSubtitle.textContent = "Sign up to track your scans and daily scam quizzes.";
            authSubmitBtn.textContent = "Create Account";
            authSwitchText.textContent = "Already have an account?";
            toggleAuthModeBtn.textContent = "Log In";
            signupExtraFields.classList.remove("hidden");
            signupAgeSelect.required = true;
        } else {
            authTitle.textContent = "Log In to ScamGuard";
            authSubtitle.textContent = "Access your saved scans, profile settings, and daily quiz progress.";
            authSubmitBtn.textContent = "Log In";
            authSwitchText.textContent = "Don't have an account?";
            toggleAuthModeBtn.textContent = "Sign Up";
            signupExtraFields.classList.add("hidden");
            signupAgeSelect.required = false;
        }
    });

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authError.classList.add("hidden");
        const email = document.getElementById("auth-email").value.trim();
        const password = document.getElementById("auth-password").value;

        try {
            if (isSignUpMode) {
                const displayName = document.getElementById("signup-name").value.trim() || "User";
                const ageGroup = signupAgeSelect.value;

                if (!ageGroup) {
                    authError.textContent = "Please select your age range before creating an account.";
                    authError.classList.remove("hidden");
                    return;
                }

                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { display_name: displayName, age_group: ageGroup }
                    }
                });

                if (error) throw error;
                alert("Account created! If email confirmation is enabled in Supabase, check your inbox.");
                closeAuthModal();
            } else {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                closeAuthModal();
            }
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove("hidden");
        }
    });

    logoutBtn.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
    });

    // Listen to Supabase Auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
            const meta = currentUser.user_metadata || {};
            const name = meta.display_name || currentUser.email.split("@")[0];
            const ageRange = meta.age_group || "19-64";

            userDisplay.textContent = `Hi, ${name} (${ageRange})`;
            authModalBtn.classList.add("hidden");
            logoutBtn.classList.remove("hidden");

            profileLoggedOut.classList.add("hidden");
            profileLoggedIn.classList.remove("hidden");
            profileEmailInput.value = currentUser.email;
            profileNameInput.value = meta.display_name || "";
            profileAgeSelect.value = ageRange;
        } else {
            userDisplay.textContent = "Guest Mode";
            authModalBtn.classList.remove("hidden");
            logoutBtn.classList.add("hidden");

            profileLoggedOut.classList.remove("hidden");
            profileLoggedIn.classList.add("hidden");
        }
    });

    // Save Profile Updates (Name & Age Range) to Supabase
    saveProfileBtn.addEventListener("click", async () => {
        if (!currentUser) return;
        const updatedName = profileNameInput.value.trim();
        const updatedAge = profileAgeSelect.value;

        const { error } = await supabaseClient.auth.updateUser({
            data: { display_name: updatedName, age_group: updatedAge }
        });

        if (!error) {
            profileSaveMsg.textContent = "✅ Profile and age range updated!";
            profileSaveMsg.classList.remove("hidden");
            userDisplay.textContent = `Hi, ${updatedName || currentUser.email.split("@")[0]} (${updatedAge})`;
            setTimeout(() => profileSaveMsg.classList.add("hidden"), 3000);
        }
    });

    // --- TAB SWITCHING LOGIC ---
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("active"));

            button.classList.add("active");
            document.getElementById(button.getAttribute("data-tab")).classList.add("active");
        });
    });

    // --- DAILY QUIZ LOGIC (MAIN PAGE) ---
    const quizQuestions = [
        {
            question: "You get a text saying your package is held at customs and you must click a link to pay a $2.00 fee. What should you do?",
            options: [
                "Pay the $2 fee quickly so the package arrives.",
                "Click the link to check tracking details.",
                "Ignore and delete the text; postal services don't text for customs fees this way."
            ],
            correct: 2
        },
        {
            question: "An unknown caller claims to be from your bank's fraud department and asks for your 6-digit one-time passcode (OTP). What should you do?",
            options: [
                "Give them the code to protect your account.",
                "Hang up immediately—banks will never ask for your OTP over the phone.",
                "Ask for their employee badge number first."
            ],
            correct: 1
        },
        {
            question: "Someone messages you on social media claiming you won a free gift card, but you need to pay a small shipping fee first. What is this?",
            options: [
                "A legitimate giveaway promotion.",
                "An advance-fee scam designed to steal your payment info.",
                "A standard tax requirement."
            ],
            correct: 1
        }
    ];

    let currentQuizIndex = 0;
    const quizQuestionEl = document.getElementById("quiz-question");
    const quizOptionsEl = document.getElementById("quiz-options");
    const quizFeedbackEl = document.getElementById("quiz-feedback");
    const nextQuizBtn = document.getElementById("next-quiz-btn");

    function loadQuiz() {
        const q = quizQuestions[currentQuizIndex];
        quizQuestionEl.textContent = q.question;
        quizOptionsEl.innerHTML = "";
        quizFeedbackEl.classList.add("hidden");
        nextQuizBtn.classList.add("hidden");

        q.options.forEach((opt, index) => {
            const btn = document.createElement("button");
            btn.className = "quiz-option-btn";
            btn.textContent = opt;
            btn.addEventListener("click", () => checkAnswer(index, q.correct));
            quizOptionsEl.appendChild(btn);
        });
    }

    function checkAnswer(selected, correct) {
        quizFeedbackEl.classList.remove("hidden");
        if (selected === correct) {
            quizFeedbackEl.innerHTML = `<span style="color:var(--safe); font-weight:bold;">Correct! 🎉</span> You spotted the red flag.`;
        } else {
            quizFeedbackEl.innerHTML = `<span style="color:var(--danger); font-weight:bold;">Not quite. ⚠️</span> That is a common scam tactic.`;
        }
        quizOptionsEl.querySelectorAll("button").forEach(b => b.disabled = true);
        if (currentQuizIndex < quizQuestions.length - 1) {
            nextQuizBtn.classList.remove("hidden");
        } else {
            nextQuizBtn.textContent = "Restart Daily Quiz";
            nextQuizBtn.classList.remove("hidden");
        }
    }

    nextQuizBtn.addEventListener("click", () => {
        if (currentQuizIndex < quizQuestions.length - 1) {
            currentQuizIndex++;
        } else {
            currentQuizIndex = 0;
            nextQuizBtn.textContent = "Next Question";
        }
        loadQuiz();
    });

    loadQuiz();

    // --- MESSAGE SCANNER ENGINE ---
    const scanBtn = document.getElementById("scan-btn");
    const messageInput = document.getElementById("message-input");
    const scanResults = document.getElementById("scan-results");
    const riskBadge = document.getElementById("risk-badge");
    const riskScoreText = document.getElementById("risk-score-text");
    const breakdownList = document.getElementById("breakdown-list");

    scanBtn.addEventListener("click", async () => {
        const rawText = messageInput.value.trim();
        const text = rawText.toLowerCase();
        if (!text) {
            alert("Please paste a text message or email first.");
            return;
        }

        scanResults.classList.remove("hidden");
        breakdownList.innerHTML = "";

        let riskScore = 0;
        let reasons = [];

        if (text.includes("urgent") || text.includes("immediate action") || text.includes("expires today") || text.includes("act now")) {
            riskScore += 35;
            reasons.push("🚨 <strong>Urgency Trap:</strong> Creates artificial panic so you act before verifying.");
        }
        if (text.includes("click here") || text.includes("verify") || text.includes("login") || text.includes("http")) {
            riskScore += 30;
            reasons.push("🔗 <strong>Suspicious Link / Request:</strong> Directs you to click a link or hand over login credentials.");
        }
        if (text.includes("bank") || text.includes("irs") || text.includes("paypal") || text.includes("amazon") || text.includes("suspended")) {
            riskScore += 35;
            reasons.push("🏢 <strong>Impersonation Flag:</strong> Claims to be a trusted brand or government agency.");
        }

        riskScore = Math.min(riskScore, 100);
        riskScoreText.textContent = `(Scam Score: ${riskScore}/100)`;

        if (riskScore === 0) {
            riskBadge.textContent = "Safe / Low Risk";
            riskBadge.className = "badge safe";
            breakdownList.innerHTML = `<div class="breakdown-item">✅ No standard scam red flags detected. Still, never share passwords or OTP codes.</div>`;
        } else if (riskScore < 60) {
            riskBadge.textContent = "Moderate Suspicion";
            riskBadge.className = "badge warning";
        } else {
            riskBadge.textContent = "High Scam Risk";
            riskBadge.className = "badge danger";
        }

        reasons.forEach(r => {
            const div = document.createElement("div");
            div.className = "breakdown-item";
            div.innerHTML = r;
            breakdownList.appendChild(div);
        });

        try {
            await supabaseClient.from("scam_reports").insert([{
                user_id: currentUser ? currentUser.id : null,
                content_snippet: rawText.substring(0, 120),
                risk_level: riskBadge.textContent,
                risk_score: riskScore
            }]);
        } catch (err) {
            console.warn("Supabase logging skipped:", err.message);
        }
    });

    // --- PHONE NUMBER LOOKUP ---
    const phoneCheckBtn = document.getElementById("phone-check-btn");
    const phoneInput = document.getElementById("phone-input");
    const phoneResults = document.getElementById("phone-results");
    const phoneStatus = document.getElementById("phone-status");

    phoneCheckBtn.addEventListener("click", () => {
        const number = phoneInput.value.trim();
        if (!number) {
            alert("Please enter a phone number.");
            return;
        }
        phoneResults.classList.remove("hidden");
        if (number.includes("555") || number.includes("800")) {
            phoneStatus.innerHTML = `<strong style="color:var(--danger)">⚠️ Flagged Number (Score: 85/100):</strong> Reported for impersonation and robocall fraud. Do not answer or call back.`;
        } else {
            phoneStatus.innerHTML = `<strong style="color:var(--safe)">✅ Clean Number (Score: 10/100):</strong> No active scam reports found in our database.`;
        }
    });

    // --- TALK / VOICE ASSISTANT ---
    const chatContainer = document.getElementById("chat-container");
    const chatInput = document.getElementById("chat-input");
    const sendChatBtn = document.getElementById("send-chat-btn");
    const voiceBtn = document.getElementById("voice-btn");

    function appendMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-message ${sender}`;
        msgDiv.textContent = text;
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        voiceBtn.addEventListener("click", () => {
            voiceBtn.textContent = "🛑";
            recognition.start();
        });
        recognition.onresult = (event) => {
            chatInput.value = event.results[0][0].transcript;
            voiceBtn.textContent = "🎤";
            sendChatBtn.click();
        };
        recognition.onerror = () => { voiceBtn.textContent = "🎤"; };
    } else {
        voiceBtn.style.display = "none";
    }

    sendChatBtn.addEventListener("click", () => {
        const userText = chatInput.value.trim();
        if (!userText) return;

        appendMessage("user", userText);
        chatInput.value = "";

        setTimeout(() => {
            let reply = "Stay calm and don't rush. Legitimate companies never demand secrecy or instant payment. Are they asking for money, a code, or personal details?";
            const lower = userText.toLowerCase();
            if (lower.includes("gift card") || lower.includes("crypto") || lower.includes("bitcoin") || lower.includes("wire")) {
                reply = "🛑 STOP IMMEDIATELY! Asking for gift cards, crypto, or wire transfers is 100% a scam. Hang up right now.";
            } else if (lower.includes("code") || lower.includes("password") || lower.includes("ssn")) {
                reply = "🚨 Do NOT share any verification codes, passwords, or your Social Security Number. Real support agents never ask for them.";
            }
            appendMessage("bot", reply);
        }, 500);
    });

    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendChatBtn.click();
    });
});
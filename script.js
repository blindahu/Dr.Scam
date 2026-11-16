// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://arkosoknmzfthvqvpxvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i9UzYae8ms1yCkdOxRa7vw_uTpLjaSI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let authMode = "login"; // "login", "signup", or "forgot"

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
    const authSwitchContainer = document.getElementById("auth-switch-container");
    const authSwitchText = document.getElementById("auth-switch-text");
    
    const passwordGroup = document.getElementById("password-group");
    const forgotPasswordLink = document.getElementById("forgot-password-link");
    const signupExtraFields = document.getElementById("signup-extra-fields");
    const signupAgeSelect = document.getElementById("signup-age");
    const authError = document.getElementById("auth-error");
    const authSuccess = document.getElementById("auth-success");

    const profileLoggedOut = document.getElementById("profile-logged-out");
    const profileLoggedIn = document.getElementById("profile-logged-in");
    const profileEmailInput = document.getElementById("profile-email");
    const profileNameInput = document.getElementById("profile-name");
    const profileAgeSelect = document.getElementById("profile-age-group");
    const saveProfileBtn = document.getElementById("save-profile-btn");
    const profileSaveMsg = document.getElementById("profile-save-msg");

    // --- AUTH MODAL MODES SETUP ---
    function setAuthMode(mode) {
        authMode = mode;
        authError.classList.add("hidden");
        authSuccess.classList.add("hidden");
        document.getElementById("auth-email").value = "";
        document.getElementById("auth-password").value = "";

        if (mode === "login") {
            authTitle.textContent = "Log In to ScamGuard";
            authSubtitle.textContent = "Access your saved scans, profile settings, and daily quiz progress.";
            authSubmitBtn.textContent = "Log In";
            passwordGroup.classList.remove("hidden");
            signupExtraFields.classList.add("hidden");
            signupAgeSelect.required = false;
            authSwitchContainer.classList.remove("hidden");
            authSwitchText.textContent = "Don't have an account?";
            toggleAuthModeBtn.textContent = "Sign Up";
        } else if (mode === "signup") {
            authTitle.textContent = "Create a ScamGuard Profile";
            authSubtitle.textContent = "Sign up to track your scans and daily scam quizzes.";
            authSubmitBtn.textContent = "Create Account";
            passwordGroup.classList.remove("hidden");
            signupExtraFields.classList.remove("hidden");
            signupAgeSelect.required = true;
            authSwitchContainer.classList.remove("hidden");
            authSwitchText.textContent = "Already have an account?";
            toggleAuthModeBtn.textContent = "Log In";
        } else if (mode === "forgot") {
            authTitle.textContent = "Reset Your Password";
            authSubtitle.textContent = "Enter your email address and we'll send you a password reset link.";
            authSubmitBtn.textContent = "Send Reset Link";
            passwordGroup.classList.add("hidden");
            signupExtraFields.classList.add("hidden");
            signupAgeSelect.required = false;
            authSwitchContainer.classList.add("hidden"); // hide toggle switch during forgot password
        }
    }

    function openAuthModal() {
        setAuthMode("login");
        authModal.classList.remove("hidden");
    }

    function closeAuthModal() {
        authModal.classList.add("hidden");
    }

    authModalBtn.addEventListener("click", openAuthModal);
    profileOpenAuthBtn.addEventListener("click", openAuthModal);
    closeModalBtn.addEventListener("click", closeAuthModal);

    toggleAuthModeBtn.addEventListener("click", () => {
        if (authMode === "login") {
            setAuthMode("signup");
        } else {
            setAuthMode("login");
        }
    });

    forgotPasswordLink.addEventListener("click", () => {
        setAuthMode("forgot");
    });

    // --- FORM SUBMISSION (LOGIN / SIGNUP / FORGOT PASSWORD) ---
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        authError.classList.add("hidden");
        authSuccess.classList.add("hidden");
        const email = document.getElementById("auth-email").value.trim();

        try {
            if (authMode === "forgot") {
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.href, // redirects back to app after reset
                });
                if (error) throw error;
                authSuccess.textContent = "✅ Password reset link sent! Check your email inbox.";
                authSuccess.classList.remove("hidden");
                return;
            }

            const password = document.getElementById("auth-password").value;

            if (authMode === "signup") {
                const displayName = document.getElementById("signup-name").value.trim() || "User";
                const ageGroup = signupAgeSelect.value;

                if (!ageGroup) {
                    authError.textContent = "Please select your age range before creating an account.";
                    authError.classList.remove("hidden");
                    return;
                }

                const { error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { display_name: displayName, age_group: ageGroup }
                    }
                });

                if (error) throw error;
                alert("Account created successfully!");
                closeAuthModal();
            } else {
                const { error } = await supabaseClient.auth.signInWithPassword({
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

    // Listen to Supabase Auth state changes
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

    const quizQuestionEl = document.getElementById("quiz-question");
    const quizOptionsEl = document.getElementById("quiz-options");
    const quizFeedbackEl = document.getElementById("quiz-feedback");
    const nextQuizBtn = document.getElementById("next-quiz-btn");

    let currentDailyQuiz = null;

    // 1. Fetch today's cached quiz or generate it via Gemini AI
    async function loadOrGenerateDailyQuiz() {
        const todayStr = new Date().toISOString().split('T')[0];
        const GEMINI_API_KEY = "YOUR_AI_STUDIO_KEY"; // Keep your actual key here

        console.log("1. Starting loadOrGenerateDailyQuiz for date:", todayStr);
        quizQuestionEl.textContent = "Loading today's AI scam quiz...";
        quizOptionsEl.innerHTML = "";

        try {
            console.log("2. Checking Supabase cache...");
            let { data: existingQuiz, error } = await supabaseClient
                .from('daily_quizzes')
                .select('*')
                .eq('quiz_date', todayStr)
                .maybeSingle();

            if (error) {
                console.log("Supabase select error:", error);
            }

            if (existingQuiz) {
                console.log("3. Found existing quiz in Supabase cache:", existingQuiz);
                currentDailyQuiz = existingQuiz;
                renderQuiz(currentDailyQuiz);
                return;
            }

            console.log("4. No cache found. Calling Gemini API...");
            const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "You are an expert cybersecurity educator. Generate a realistic multiple-choice scam quiz question (phishing, SMS fraud, imposter scam, etc.) for users ages 13+. Output strict JSON with keys: question (string), options (array of 3 strings), correct_index (integer 0-2), explanation (string)."
                        }]
                    }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            console.log("5. Gemini API response status:", aiResponse.status);
            const aiData = await aiResponse.json();

            if (!aiResponse.ok) {
                throw new Error(aiData.error?.message || `API Error: ${aiResponse.status}`);
            }

            const quizJson = JSON.parse(aiData.candidates[0].content.parts[0].text);
            console.log("6. Parsed Gemini Quiz JSON:", quizJson);

            // Save new quiz into Supabase cache
            const { data: insertedQuiz, error: insertError } = await supabaseClient
                .from('daily_quizzes')
                .insert([{
                    quiz_date: todayStr,
                    question: quizJson.question,
                    options: quizJson.options,
                    correct_index: quizJson.correct_index,
                    explanation: quizJson.explanation
                }])
                .select()
                .single();

            if (insertError) {
                console.log("Supabase insert error:", insertError);
                throw insertError;
            }

            console.log("7. Successfully saved to Supabase and rendering!");
            currentDailyQuiz = insertedQuiz;
            renderQuiz(currentDailyQuiz);

        } catch (err) {
            console.error("❌ Error in loadOrGenerateDailyQuiz catch block:", err);
            // Fallback default question if offline/error
            renderQuiz({
                question: "You receive an unexpected urgent text about an unpaid package fee. What should you do?",
                options: ["Click the link to check", "Pay the small fee", "Ignore and delete the text"],
                correct_index: 2,
                explanation: "Unexpected delivery fee texts are a classic phishing scam."
            });
        }
    }

    // 2. Render the single daily quiz into your UI elements
    function renderQuiz(q) {
        quizQuestionEl.textContent = q.question;
        quizOptionsEl.innerHTML = "";
        quizFeedbackEl.classList.add("hidden");
        nextQuizBtn.classList.add("hidden"); // Daily quiz only has 1 question per day

        q.options.forEach((opt, index) => {
            const btn = document.createElement("button");
            btn.className = "quiz-option-btn";
            btn.textContent = opt;
            btn.addEventListener("click", () => checkAnswer(index, q.correct_index, q.explanation));
            quizOptionsEl.appendChild(btn);
        });
    }

    // 3. Handle answer validation with your custom styling
    function checkAnswer(selected, correct, explanation) {
        quizFeedbackEl.classList.remove("hidden");
        if (selected === correct) {
            quizFeedbackEl.innerHTML = `<span style="color:var(--safe); font-weight:bold;">Correct! 🎉</span> ${explanation}`;
        } else {
            quizFeedbackEl.innerHTML = `<span style="color:var(--danger); font-weight:bold;">Not quite. ⚠️</span> ${explanation}`;
        }
        quizOptionsEl.querySelectorAll("button").forEach(b => b.disabled = true);
    }

    // Initialize on page load
    loadOrGenerateDailyQuiz();

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
            await supabaseClient.from("scan_history").insert([{
                user_id: currentUser ? currentUser.id : null,
                scanned_content: rawText.substring(0, 120),
                scan_type: "message",
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
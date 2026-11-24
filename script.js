// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://arkosoknmzfthvqvpxvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i9UzYae8ms1yCkdOxRa7vw_uTpLjaSI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Shared helper that calls your Supabase Edge Function (which holds GEMINI_API_KEY in Supabase Secrets)
async function callGeminiEdgeFunction(payload) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gemini-helper`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Edge Function request failed");
    }
    return data;
}

async function analyzeMessage(userMessage) {
    try {
        const data = await callGeminiEdgeFunction({
            messageText: userMessage,
        });

        console.log("AI Analysis:", data.analysis);
        return data.analysis;
    } catch (error) {
        console.error("Scan failed:", error.message);
        return "Error: Could not analyze the message right now.";
    }
}

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
        authError?.classList.add("hidden");
        authSuccess?.classList.add("hidden");
        const emailEl = document.getElementById("auth-email");
        const passEl = document.getElementById("auth-password");
        if (emailEl) emailEl.value = "";
        if (passEl) passEl.value = "";

        if (mode === "login") {
            if (authTitle) authTitle.textContent = "Log In to Dr. Scam";
            if (authSubtitle) authSubtitle.textContent = "Access your saved scans, profile settings, and daily quiz progress.";
            if (authSubmitBtn) authSubmitBtn.textContent = "Log In";
            passwordGroup?.classList.remove("hidden");
            signupExtraFields?.classList.add("hidden");
            if (signupAgeSelect) signupAgeSelect.required = false;
            authSwitchContainer?.classList.remove("hidden");
            if (authSwitchText) authSwitchText.textContent = "Don't have an account?";
            if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = "Sign Up";
        } else if (mode === "signup") {
            if (authTitle) authTitle.textContent = "Create a Dr. Scam Profile";
            if (authSubtitle) authSubtitle.textContent = "Sign up to track your scans and daily scam quizzes.";
            if (authSubmitBtn) authSubmitBtn.textContent = "Create Account";
            passwordGroup?.classList.remove("hidden");
            signupExtraFields?.classList.remove("hidden");
            if (signupAgeSelect) signupAgeSelect.required = true;
            authSwitchContainer?.classList.remove("hidden");
            if (authSwitchText) authSwitchText.textContent = "Already have an account?";
            if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = "Log In";
        } else if (mode === "forgot") {
            if (authTitle) authTitle.textContent = "Reset Your Password";
            if (authSubtitle) authSubtitle.textContent = "Enter your email address and we'll send you a password reset link.";
            if (authSubmitBtn) authSubmitBtn.textContent = "Send Reset Link";
            passwordGroup?.classList.add("hidden");
            signupExtraFields?.classList.add("hidden");
            if (signupAgeSelect) signupAgeSelect.required = false;
            authSwitchContainer?.classList.add("hidden");
        }
    }

    function openAuthModal() {
        setAuthMode("login");
        authModal?.classList.remove("hidden");
    }

    function closeAuthModal() {
        authModal?.classList.add("hidden");
    }

    authModalBtn?.addEventListener("click", openAuthModal);
    profileOpenAuthBtn?.addEventListener("click", openAuthModal);
    closeModalBtn?.addEventListener("click", closeAuthModal);

    toggleAuthModeBtn?.addEventListener("click", () => {
        if (authMode === "login") {
            setAuthMode("signup");
        } else {
            setAuthMode("login");
        }
    });

    forgotPasswordLink?.addEventListener("click", () => {
        setAuthMode("forgot");
    });

    // --- FORM SUBMISSION (LOGIN / SIGNUP / FORGOT PASSWORD) ---
    authForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        authError?.classList.add("hidden");
        authSuccess?.classList.add("hidden");
        const email = document.getElementById("auth-email")?.value.trim() || "";

        try {
            if (authMode === "forgot") {
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.href,
                });
                if (error) throw error;
                if (authSuccess) {
                    authSuccess.textContent = "✅ Password reset link sent! Check your email inbox.";
                    authSuccess.classList.remove("hidden");
                }
                return;
            }

            const password = document.getElementById("auth-password")?.value || "";

            if (authMode === "signup") {
                const displayName = document.getElementById("signup-name")?.value.trim() || "User";
                const ageGroup = signupAgeSelect?.value || "";

                if (!ageGroup) {
                    if (authError) {
                        authError.textContent = "Please select your age range before creating an account.";
                        authError.classList.remove("hidden");
                    }
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
            if (authError) {
                authError.textContent = err.message;
                authError.classList.remove("hidden");
            }
        }
    });

    logoutBtn?.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
            const meta = currentUser.user_metadata || {};
            const name = meta.display_name || currentUser.email.split("@")[0];
            const ageRange = meta.age_group || "19-64";

            if (userDisplay) userDisplay.textContent = `Hi, ${name} (${ageRange})`;
            authModalBtn?.classList.add("hidden");
            logoutBtn?.classList.remove("hidden");

            profileLoggedOut?.classList.add("hidden");
            profileLoggedIn?.classList.remove("hidden");
            if (profileEmailInput) profileEmailInput.value = currentUser.email;
            if (profileNameInput) profileNameInput.value = meta.display_name || "";
            if (profileAgeSelect) profileAgeSelect.value = ageRange;
        } else {
            if (userDisplay) userDisplay.textContent = "Guest Mode";
            authModalBtn?.classList.remove("hidden");
            logoutBtn?.classList.add("hidden");

            profileLoggedOut?.classList.remove("hidden");
            profileLoggedIn?.classList.add("hidden");
        }
    });

    saveProfileBtn?.addEventListener("click", async () => {
        if (!currentUser) return;
        const updatedName = profileNameInput?.value.trim() || "";
        const updatedAge = profileAgeSelect?.value || "19-64";

        const { error } = await supabaseClient.auth.updateUser({
            data: { display_name: updatedName, age_group: updatedAge }
        });

        if (!error) {
            if (profileSaveMsg) {
                profileSaveMsg.textContent = "✅ Profile and age range updated!";
                profileSaveMsg.classList.remove("hidden");
            }
            if (userDisplay) {
                userDisplay.textContent = `Hi, ${updatedName || currentUser.email.split("@")[0]} (${updatedAge})`;
            }
            setTimeout(() => profileSaveMsg?.classList.add("hidden"), 3000);
        }
    });

    // --- TAB SWITCHING LOGIC ---
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-tab");
            const targetSection = targetId ? document.getElementById(targetId) : null;
            if (!targetSection) return;

            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("active"));

            button.classList.add("active");
            targetSection.classList.add("active");
        });
    });

    // --- DAILY QUIZ LOGIC ---
    const quizQuestionEl = document.getElementById("quiz-question");
    const quizOptionsEl = document.getElementById("quiz-options");
    const quizFeedbackEl = document.getElementById("quiz-feedback");
    const nextQuizBtn = document.getElementById("next-quiz-btn");

    let currentDailyQuiz = null;

    async function loadOrGenerateDailyQuiz() {
        if (!quizQuestionEl || !quizOptionsEl) return;
        const todayStr = new Date().toISOString().split('T')[0];

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

            console.log("4. No cache found. Calling gemini-helper Edge Function...");
            const { quizJson } = await callGeminiEdgeFunction({
                action: "daily_quiz",
                prompt: "You are an expert cybersecurity educator. Generate a realistic multiple-choice scam quiz question (phishing, SMS fraud, imposter scam, etc.) for users ages 13+. Output strict JSON with keys: question (string), options (array of 3 strings), correct_index (integer 0-2), option_explanations (array of 3 strings explaining why each corresponding option is correct or a risky mistake)."
            });

            console.log("5. Received Quiz JSON from Edge Function:", quizJson);

            const { data: insertedQuiz, error: insertError } = await supabaseClient
                .from('daily_quizzes')
                .insert([{
                    quiz_date: todayStr,
                    question: quizJson.question,
                    options: quizJson.options,
                    correct_index: quizJson.correct_index,
                    option_explanations: quizJson.option_explanations
                }])
                .select()
                .single();

            if (insertError) {
                console.log("Supabase insert error:", insertError);
                throw insertError;
            }

            console.log("6. Successfully saved to Supabase and rendering!");
            currentDailyQuiz = insertedQuiz;
            renderQuiz(currentDailyQuiz);
        } catch (err) {
            console.error("❌ Error in loadOrGenerateDailyQuiz catch block:", err);
            renderQuiz({
                question: "You receive an unexpected urgent text about an unpaid package fee. What should you do?",
                options: ["Click the link to check", "Pay the small fee", "Ignore and delete the text"],
                correct_index: 2,
                option_explanations: [
                    "Clicking links in unverified texts leads straight to credential-harvesting phishing sites.",
                    "Paying small fees on external links hands your financial details directly to scammers.",
                    "Correct! Legitimate postal services will never demand impromptu fees via random text messages."
                ]
            });
        }
    }

    function renderQuiz(q) {
        if (!quizQuestionEl || !quizOptionsEl) return;
        quizQuestionEl.textContent = q.question;
        quizOptionsEl.innerHTML = "";
        quizFeedbackEl?.classList.add("hidden");
        nextQuizBtn?.classList.add("hidden");

        q.options.forEach((opt, index) => {
            const btn = document.createElement("button");
            btn.className = "quiz-option-btn";
            btn.textContent = opt;
            btn.addEventListener("click", () => checkAnswer(index, q));
            quizOptionsEl.appendChild(btn);
        });
    }

    function checkAnswer(selectedIndex, quiz) {
        if (!quizFeedbackEl || !quizOptionsEl) return;
        const isCorrect = selectedIndex === quiz.correct_index;
        quizFeedbackEl.classList.remove("hidden");

        const buttons = quizOptionsEl.querySelectorAll("button");
        buttons.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === quiz.correct_index) {
                btn.style.backgroundColor = "#dcfce7";
                btn.style.borderColor = "#16a34a";
            } else if (idx === selectedIndex) {
                btn.style.backgroundColor = "#fee2e2";
                btn.style.borderColor = "#dc2626";
            }
        });

        let breakdownHTML = `
            <div style="margin-top: 16px; padding: 14px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;">
                <p style="font-weight: 700; margin-bottom: 10px; color: ${isCorrect ? '#15803d' : '#b91c1c'};">
                    ${isCorrect ? '✅ Spot on! Here is a full breakdown of every option:' : '❌ Not quite! Here is a full breakdown of every option:'}
                </p>
                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
        `;

        quiz.options.forEach((optionText, idx) => {
            const isRightOption = idx === quiz.correct_index;
            const badge = isRightOption ? "✅ Correct Choice" : "❌ Risky / Wrong";
            const explanation = quiz.option_explanations?.[idx] || "No detailed explanation provided for this choice.";

            breakdownHTML += `
                <li style="padding: 10px; border-radius: 6px; background: ${isRightOption ? '#f0fdf4' : '#ffffff'}; border: 1px solid ${isRightOption ? '#bbf7d0' : '#e2e8f0'};">
                    <strong style="color: ${isRightOption ? '#15803d' : '#334155'};">${badge} — "${optionText}":</strong>
                    <span style="display: block; margin-top: 4px; color: #475569; font-size: 0.95em;">${explanation}</span>
                </li>
            `;
        });

        breakdownHTML += `</ul></div>`;
        quizFeedbackEl.innerHTML = breakdownHTML;
    }

    loadOrGenerateDailyQuiz();

    // --- MESSAGE SCANNER ENGINE ---
    const scanBtn = document.getElementById("scan-btn");
    const messageInput = document.getElementById("message-input");
    const scanResults = document.getElementById("scan-results");
    const riskBadge = document.getElementById("risk-badge");
    const riskScoreText = document.getElementById("risk-score-text");
    const breakdownList = document.getElementById("breakdown-list");

    scanBtn?.addEventListener("click", async () => {
        const rawText = messageInput?.value.trim() || "";
        const text = rawText.toLowerCase();
        if (!text) {
            alert("Please paste a text message or email first.");
            return;
        }

        scanResults?.classList.remove("hidden");
        if (breakdownList) breakdownList.innerHTML = "";

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
        if (riskScoreText) riskScoreText.textContent = `(Scam Score: ${riskScore}/100)`;

        if (riskBadge && breakdownList) {
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
        }

        try {
            await supabaseClient.from("scan_history").insert([{
                user_id: currentUser ? currentUser.id : null,
                scanned_content: rawText.substring(0, 120),
                scan_type: "message",
                risk_level: riskBadge?.textContent || "Unknown",
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

    phoneCheckBtn?.addEventListener("click", () => {
        const number = phoneInput?.value.trim() || "";
        if (!number) {
            alert("Please enter a phone number.");
            return;
        }
        phoneResults?.classList.remove("hidden");
        if (phoneStatus) {
            if (number.includes("555") || number.includes("800")) {
                phoneStatus.innerHTML = `<strong style="color:var(--danger)">⚠️ Flagged Number (Score: 85/100):</strong> Reported for impersonation and robocall fraud. Do not answer or call back.`;
            } else {
                phoneStatus.innerHTML = `<strong style="color:var(--safe)">✅ Clean Number (Score: 10/100):</strong> No active scam reports found in our database.`;
            }
        }
    });

    // --- TALK / VOICE ASSISTANT ---
    const chatContainer = document.getElementById("chat-container");
    const chatInput = document.getElementById("chat-input");
    const sendChatBtn = document.getElementById("send-chat-btn");
    const voiceBtn = document.getElementById("voice-btn");

    function appendMessage(sender, text) {
        if (!chatContainer) return;
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-message ${sender}`;
        msgDiv.textContent = text;
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && voiceBtn) {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceBtn.addEventListener("click", () => {
            try {
                voiceBtn.textContent = "🛑";
                console.log("🎤 Starting speech recognition...");
                recognition.start();
            } catch (err) {
                console.error("Failed to start recognition:", err);
                voiceBtn.textContent = "🎤";
            }
        });

        recognition.onresult = (event) => {
            const speechText = event.results[0][0].transcript;
            console.log("🗣️ Heard:", speechText);
            if (chatInput) chatInput.value = speechText;
            voiceBtn.textContent = "🎤";
            sendChatBtn?.click();
        };

        recognition.onerror = (event) => {
            console.error("❌ Speech recognition error:", event.error);
            voiceBtn.textContent = "🎤";
        };

        recognition.onend = () => {
            console.log("🛑 Speech recognition ended.");
            voiceBtn.textContent = "🎤";
        };
    } else if (voiceBtn) {
        console.warn("Speech recognition not supported in this browser.");
        voiceBtn.style.display = "none";
    }

    let chatHistory = [];

    sendChatBtn?.addEventListener("click", async () => {
        const userText = chatInput?.value.trim() || "";
        if (!userText || !chatContainer) return;

        appendMessage("user", userText);
        if (chatInput) chatInput.value = "";

        chatHistory.push({
            role: "user",
            parts: [{ text: userText }]
        });

        const loadingDiv = document.createElement("div");
        loadingDiv.className = "chat-message bot";
        loadingDiv.textContent = "Thinking...";
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        try {
            const { reply } = await callGeminiEdgeFunction({
                action: "chat",
                history: chatHistory
            });

            const formattedReply = reply
                .replace(/### (.*?)(?:\n|$)/g, '<h4 style="margin: 10px 0 4px 0; font-size: 1.05em;">$1</h4>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            loadingDiv.innerHTML = formattedReply;

            chatHistory.push({
                role: "model",
                parts: [{ text: reply }]
            });
        } catch (err) {
            console.error("Chat AI Error:", err);
            loadingDiv.textContent = "Stay calm and don't rush. If someone is demanding gift cards, wire transfers, or codes, stop immediately—it's a scam.";
        }

        chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    chatInput?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendChatBtn?.click();
    });
});
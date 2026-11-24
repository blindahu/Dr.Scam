// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://arkosoknmzfthvqvpxvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i9UzYae8ms1yCkdOxRa7vw_uTpLjaSI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Shared helper that calls your Supabase Edge Function (holding GEMINI_API_KEY in Supabase Secrets)
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

    const textResponse = await response.text();
    let data;
    try {
        data = JSON.parse(textResponse);
    } catch {
        throw new Error(`Server returned non-JSON (Status ${response.status}). Check your Edge Function deployment or API key.`);
    }

    if (!response.ok) {
        throw new Error(data.error || "Edge Function request failed");
    }
    return data;
}

// Calls Gemini via Edge Function for structured scam analysis, with fallback to keyword analysis
async function analyzeMessageWithAI(userMessage, senderContact = "") {
    const cleanSender = String(senderContact || "").trim();
    const senderContextLine = cleanSender
        ? `Sender Address / Number (the sender who sent this message/email, NOT the recipient): ${cleanSender}\n`
        : "Sender Address / Number: Not provided\n";

    const prompt = `You are a cybersecurity and scam-detection expert. Analyze the following text message or email—including the sender's email address or phone number if provided (such as lookalike/spoofed domains, free/unusual senders for official brands, or suspicious numbers)—and return STRICT JSON only (no markdown code fences, no extra text) with this exact structure:
{
  "scam_percentage": <integer from 0 to 100 representing how likely it is a scam>,
  "summary": "<one-sentence overall verdict>",
  "suspicious_parts": [
    {
      "snippet": "<exact quote, URL, sender address/number, or phrase that looks suspicious>",
      "reason": "<clear explanation of why this specific part looks like a scam>"
    }
  ],
  "what_to_do": [
    "<clear, actionable step 1 for the user>",
    "<clear, actionable step 2 for the user>",
    "<clear, actionable step 3 for the user>"
  ]
}

` + senderContextLine + `Message to analyze:
"""` + userMessage + `"""`;

    try {
        const data = await callGeminiEdgeFunction({
            action: "analyze_message",
            senderContact: cleanSender,
            messageText: userMessage,
            prompt
        });

        let parsed = null;
        if (data?.analysis && typeof data.analysis === "object") {
            parsed = data.analysis;
        } else {
            const rawCandidate =
                data?.analysis ||
                data?.result ||
                data?.reply ||
                data?.text ||
                "";

            if (typeof rawCandidate === "string" && rawCandidate.trim()) {
                const cleaned = rawCandidate
                    .replace(/^```json\s*/i, "")
                    .replace(/^```\s*/i, "")
                    .replace(/```$/i, "")
                    .trim();
                parsed = JSON.parse(cleaned);
            }
        }

        if (parsed && typeof parsed.scam_percentage === "number") {
            return {
                source: "ai",
                senderContact: cleanSender,
                scamPercentage: Math.max(0, Math.min(100, Math.round(parsed.scam_percentage))),
                summary: parsed.summary || "",
                suspiciousParts: Array.isArray(parsed.suspicious_parts) ? parsed.suspicious_parts : [],
                whatToDo: Array.isArray(parsed.what_to_do) ? parsed.whatToDo : []
            };
        }
    } catch (err) {
        console.warn("AI message analysis fell back to local heuristic:", err.message);
    }

    let score = 0;
    const suspiciousParts = [];

    if (cleanSender) {
        const isEmail = cleanSender.includes("@");
        if (isEmail && /(support|security|billing|account|irs|bank|paypal|amazon|apple|netflix).*(gmail|yahoo|hotmail|outlook)\./i.test(cleanSender)) {
            score += 25;
            suspiciousParts.push({
                snippet: cleanSender,
                reason: "Uses a free personal email domain to claim to be an official organization or support team."
            });
        }
    }

    const scamPatterns = [
        {
            regex: /(photos|videos|files|data|account).*(deleted|suspended|locked|terminated|expire[sd]?)/i,
            points: 35,
            snippet: "Data / account deletion or expiration threat",
            reason: "Uses fear and urgency around losing photos, files, or account access to pressure immediate action."
        },
        {
            regex: /(unable to renew|payment failed|billing issue|update.*payment|cloud storage)/i,
            points: 30,
            snippet: "Cloud storage / payment renewal notice",
            reason: "Claims a subscription or storage renewal failed and prompts you to update payment details."
        },
        {
            regex: /https?:\/\/\S+|click here|verify|login|reset password|update account|update my payment/i,
            points: 35,
            snippet: "Payment / account verification prompt",
            reason: "Directs you to enter sensitive billing or login credentials outside your official account settings."
        }
    ];

    for (const rule of scamPatterns) {
        if (rule.regex.test(userMessage)) {
            score += rule.points;
            suspiciousParts.push({
                snippet: rule.snippet,
                reason: rule.reason
            });
        }
    }

    score = Math.min(100, score);
    return {
        source: "fallback",
        senderContact: cleanSender,
        scamPercentage: score,
        summary: score >= 60 ? "This message shows strong signs of a scam." : "No clear scam indicators detected.",
        suspiciousParts,
        whatToDo: [
            "Do not click payment or account links inside unexpected messages.",
            "Check your official account or billing page directly in a new browser tab.",
            "Never share passwords, one-time codes, or card details from a link."
        ]
    };
}

/**
 * GEMINI PHONE NUMBER LOOKUP HANDLER (Tab 2)
 */
async function handlePhoneCheck(event) {
    if (event) {
        event.preventDefault();
    }
    
    const phoneInput = document.getElementById("phone-input").value.trim();
    const statusBox = document.getElementById("phone-status");
    const resultsBox = document.getElementById("phone-results");
    
    if (!phoneInput) {
        alert("Please enter a phone number.");
        return;
    }

    resultsBox.classList.remove("hidden");
    statusBox.innerHTML = `<p class="loading-text">Analyzing phone number with AI...</p>`;

    try {
        const data = await callGeminiEdgeFunction({
            action: "analyze_phone",
            phone: phoneInput
        });

        const p = data.phone; 
        
        // Extract numeric risk percentage safely
        const riskPercentage = typeof p.risk_percentage === "number" ? p.risk_percentage : 0;
        
        // Determine badge styling based on percentage thresholds
        let badgeClass = "badge safe";
        if (riskPercentage >= 60) {
            badgeClass = "badge danger";
        } else if (riskPercentage >= 25) {
            badgeClass = "badge warning";
        }

        statusBox.innerHTML = `
            <div class="safety-report-card">
                <p><strong>Phone Number:</strong> ${escapeHtml(phoneInput)}</p>
                <p><strong>Valid Format:</strong> ${p.valid ? "Yes" : "No"}</p>
                <p><strong>Carrier:</strong> ${escapeHtml(p.carrier || "Unknown")}</p>
                <p><strong>Risk Level:</strong> <span class="${badgeClass}">${riskPercentage}% Risk</span></p>
                <p><strong>AI Analysis:</strong> ${escapeHtml(p.description || "No additional details provided.")}</p>
                ${data.modelUsed ? `<small class="text-muted">Analyzed using: ${data.modelUsed}</small>` : ""}
            </div>
        `;

    } catch (err) {
        console.error("Phone lookup failed:", err);
        statusBox.innerHTML = `<p class="error-text">❌ Lookup Error: ${escapeHtml(err.message)}</p>`;
    }
}

/**
 * Utility helper to prevent XSS
 */
function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;
    let authMode = "login";

    const authModal = document.getElementById("auth-modal");
    const profileOpenAuthBtn = document.getElementById("profile-open-auth-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");

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

    // --- IMAGE UPLOAD, CAMERA CAPTURE, PREVIEW & OCR LOGIC ---
    const imageUploadInput = document.getElementById("image-upload-input");
    const takePhotoBtn = document.getElementById("take-photo-btn");
    const webcamBox = document.getElementById("webcam-box");
    const webcamVideo = document.getElementById("webcam-video");
    const webcamCanvas = document.getElementById("webcam-canvas");
    const snapPhotoBtn = document.getElementById("snap-photo-btn");
    const cancelWebcamBtn = document.getElementById("cancel-webcam-btn");
    const cameraErrorMsg = document.getElementById("camera-error-msg");

    const imagePreviewBox = document.getElementById("image-preview-box");
    const imagePreview = document.getElementById("image-preview");
    const ocrStatus = document.getElementById("ocr-status");
    const removeImageBtn = document.getElementById("remove-image-btn");
    const messageInput = document.getElementById("message-input");

    let webcamStream = null;

    function stopWebcamStream() {
        if (webcamStream) {
            webcamStream.getTracks().forEach((track) => track.stop());
            webcamStream = null;
        }
        if (webcamVideo) {
            webcamVideo.srcObject = null;
        }
        webcamBox?.classList.add("hidden");
    }

    async function runOcrOnDataUrl(dataUrl, label = "image") {
        if (!dataUrl || !imagePreview || !imagePreviewBox) return;

        imagePreview.src = dataUrl;
        imagePreviewBox.classList.remove("hidden");
        if (ocrStatus) {
            ocrStatus.textContent = `Loaded "${label}" — reading text...`;
        }

        if (typeof window.Tesseract !== "undefined") {
            try {
                const { data } = await window.Tesseract.recognize(dataUrl, "eng");
                const extracted = (data?.text || "").trim();
                if (extracted && messageInput) {
                    messageInput.value = extracted;
                }
                if (ocrStatus) {
                    ocrStatus.textContent = extracted
                        ? "Text extracted from image."
                        : "Image uploaded (no text detected).";
                }
            } catch (err) {
                console.error("OCR failed:", err);
                if (ocrStatus) {
                    ocrStatus.textContent = "Image uploaded (could not read text automatically).";
                }
            }
        } else if (ocrStatus) {
            ocrStatus.textContent = `Uploaded "${label}"`;
        }
    }

    async function handleImageSelected(file) {
        if (!file || !file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target?.result;
            if (!dataUrl) return;
            await runOcrOnDataUrl(dataUrl, file.name);
        };
        reader.readAsDataURL(file);
    }

    takePhotoBtn?.addEventListener("click", async () => {
        cameraErrorMsg?.classList.add("hidden");
        if (cameraErrorMsg) cameraErrorMsg.textContent = "";

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (cameraErrorMsg) {
                cameraErrorMsg.textContent = "Camera access is not supported in this browser or requires HTTPS / localhost.";
                cameraErrorMsg.classList.remove("hidden");
            }
            return;
        }

        try {
            stopWebcamStream();
            let stream = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
                    audio: false
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }
            webcamStream = stream;
            if (webcamVideo) {
                webcamVideo.srcObject = webcamStream;
                await webcamVideo.play();
            }
            webcamBox?.classList.remove("hidden");
        } catch (err) {
            console.error("Webcam error:", err);
            let friendlyMsg = "Could not open camera. Check browser permissions.";
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                friendlyMsg = "Camera permission was denied. Allow camera access in your browser settings.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                friendlyMsg = "No camera was found on this device.";
            } else if (!window.isSecureContext) {
                friendlyMsg = "Camera requires a secure context (HTTPS or localhost).";
            }
            if (cameraErrorMsg) {
                cameraErrorMsg.textContent = friendlyMsg;
                cameraErrorMsg.classList.remove("hidden");
            }
        }
    });

    snapPhotoBtn?.addEventListener("click", async () => {
        if (!webcamVideo || !webcamCanvas) return;
        const width = webcamVideo.videoWidth || 640;
        const height = webcamVideo.videoHeight || 480;
        webcamCanvas.width = width;
        webcamCanvas.height = height;

        const ctx = webcamCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(webcamVideo, 0, 0, width, height);

        const dataUrl = webcamCanvas.toDataURL("image/jpeg", 0.92);
        stopWebcamStream();
        await runOcrOnDataUrl(dataUrl, "camera-photo.jpg");
    });

    cancelWebcamBtn?.addEventListener("click", () => {
        stopWebcamStream();
    });

    imageUploadInput?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageSelected(file);
        }
    });

    removeImageBtn?.addEventListener("click", () => {
        if (imageUploadInput) imageUploadInput.value = "";
        if (imagePreview) imagePreview.src = "";
        imagePreviewBox?.classList.add("hidden");
        if (ocrStatus) ocrStatus.textContent = "Reading text from image...";
    });

    // --- MESSAGE / EMAIL SCANNER LOGIC (Tab 1) ---
    const scanBtn = document.getElementById("scan-btn");
    const scanResultsBox = document.getElementById("scan-results");
    const riskBadge = document.getElementById("risk-badge");
    const riskScoreText = document.getElementById("risk-score-text");
    const breakdownList = document.getElementById("breakdown-list");

    function renderScanReport(report) {
        if (!scanResultsBox || !riskBadge || !riskScoreText || !breakdownList) return;

        const score = report.scamPercentage ?? 0;
        riskBadge.className = "badge";
        if (score >= 60) {
            riskBadge.classList.add("danger");
            riskBadge.textContent = "High Risk";
        } else if (score >= 25) {
            riskBadge.classList.add("warning");
            riskBadge.textContent = "Suspicious";
        } else {
            riskBadge.classList.add("safe");
            riskBadge.textContent = "Low Risk";
        }

        riskScoreText.textContent = `${score}% likelihood`;

        let html = "";
        if (report.summary) {
            html += `<div class="breakdown-item"><strong>Verdict:</strong> ${escapeHtml(report.summary)}</div>`;
        }

        if (Array.isArray(report.suspiciousParts) && report.suspiciousParts.length > 0) {
            report.suspiciousParts.forEach((part) => {
                html += `
                    <div class="breakdown-item suspicious-part">
                        <span class="suspicious-quote">${escapeHtml(part.snippet || "")}</span>
                        <p style="margin:0;">${escapeHtml(part.reason || "")}</p>
                    </div>
                `;
            });
        }

        if (Array.isArray(report.whatToDo) && report.whatToDo.length > 0) {
            html += `
                <div class="action-steps-box">
                    <h4>What to Do Next</h4>
                    <ol class="action-steps-list">
                        ${report.whatToDo.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
                    </ol>
                </div>
            `;
        }

        breakdownList.innerHTML = html || `<div class="breakdown-item">No specific red flags returned.</div>`;
        scanResultsBox.classList.remove("hidden");
    }

    scanBtn?.addEventListener("click", async () => {
        const textToScan = (messageInput?.value || "").trim();
        if (!textToScan) {
            alert("Please paste a message or upload an image with text first.");
            return;
        }

        scanBtn.disabled = true;
        scanBtn.textContent = "Scanning...";
        scanResultsBox?.classList.remove("hidden");
        if (riskScoreText) riskScoreText.textContent = "Analyzing...";
        if (breakdownList) breakdownList.innerHTML = `<div class="breakdown-item">Checking message for scam indicators...</div>`;

        try {
            const report = await analyzeMessageWithAI(textToScan);
            renderScanReport(report);
        } catch (err) {
            console.error("Scan error:", err);
            if (breakdownList) {
                breakdownList.innerHTML = `<div class="breakdown-item suspicious-part">Scan failed: ${escapeHtml(err.message)}</div>`;
            }
        } finally {
            scanBtn.disabled = false;
            scanBtn.textContent = "Scan for Scam";
        }
    });

    // --- PHONE CHECK EVENT LISTENERS ---
    const phoneCheckBtn = document.getElementById("phone-check-btn");
    if (phoneCheckBtn) {
        phoneCheckBtn.addEventListener("click", handlePhoneCheck);
    }

    const phoneInputEl = document.getElementById("phone-input");
    if (phoneInputEl) {
        phoneInputEl.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                handlePhoneCheck(e);
            }
        });
    }

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
            if (authTitle) authTitle.textContent = "Log In to ScamGuard";
            if (authSubtitle) authSubtitle.textContent = "Access your saved scans, profile settings, and daily quiz progress.";
            if (authSubmitBtn) authSubmitBtn.textContent = "Log In";
            passwordGroup?.classList.remove("hidden");
            signupExtraFields?.classList.add("hidden");
            if (signupAgeSelect) signupAgeSelect.required = false;
            authSwitchContainer?.classList.remove("hidden");
            if (authSwitchText) authSwitchText.textContent = "Don't have an account?";
            if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = "Sign Up";
        } else if (mode === "signup") {
            if (authTitle) authTitle.textContent = "Create a ScamGuard Profile";
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

    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
            const meta = currentUser.user_metadata || {};
            const name = meta.display_name || currentUser.email.split("@")[0];
            const ageRange = meta.age_group || "19-64";

            profileLoggedOut?.classList.add("hidden");
            profileLoggedIn?.classList.remove("hidden");
            if (profileEmailInput) profileEmailInput.value = currentUser.email;
            if (profileNameInput) profileNameInput.value = meta.display_name || "";
            if (profileAgeSelect) profileAgeSelect.value = ageRange;
        } else {
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

        quizQuestionEl.textContent = "Loading today's AI scam quiz...";
        quizOptionsEl.innerHTML = "";

        try {
            let { data: existingQuiz, error } = await supabaseClient
                .from('daily_quizzes')
                .select('*')
                .eq('quiz_date', todayStr)
                .maybeSingle();

            if (existingQuiz) {
                currentDailyQuiz = existingQuiz;
                renderQuiz(currentDailyQuiz);
                return;
            }

            const { quizJson } = await callGeminiEdgeFunction({
                action: "daily_quiz",
                prompt: "You are an expert cybersecurity educator. Generate a realistic multiple-choice scam quiz question (phishing, SMS fraud, imposter scam, etc.) for users ages 13+. Output strict JSON with keys: question (string), options (array of 3 strings), correct_index (integer 0-2), option_explanations (array of 3 strings explaining why each corresponding option is correct or a risky mistake)."
            });

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

            if (insertError) throw insertError;

            currentDailyQuiz = insertedQuiz;
            renderQuiz(currentDailyQuiz);
        } catch (err) {
            console.error("❌ Error loading quiz:", err);
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
            const explanation = quiz.option_explanations?.[idx] || "No detailed explanation provided.";

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
});
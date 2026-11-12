// JavaScript App Logic with Supabase Integration

// Initialize Supabase Client (Replace with your actual Supabase URL and Anon Key)
const SUPABASE_URL = 'https://arkosoknmzfthvqvpxvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i9UzYae8ms1yCkdOxRa7vw_uTpLjaSI';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  // DOM Element References
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const fileInput = document.getElementById('file-upload');
  const fileNameDisplay = document.getElementById('file-name');
  const textInput = document.getElementById('scam-text-input');
  const phoneInput = document.getElementById('phone-input');
  const phoneNotes = document.getElementById('phone-notes');

  const analyzeTextBtn = document.getElementById('analyze-text-btn');
  const analyzePhoneBtn = document.getElementById('analyze-phone-btn');
  const analyzeVoiceBtn = document.getElementById('analyze-voice-btn');

  const resultSection = document.getElementById('result-section');
  const riskBadge = document.getElementById('risk-badge');
  const scoreBar = document.getElementById('score-bar');
  const scoreValue = document.getElementById('score-value');
  const breakdownList = document.getElementById('breakdown-list');
  const adviceList = document.getElementById('advice-list');

  const micBtn = document.getElementById('mic-btn');
  const micStatus = document.getElementById('mic-status');
  const speechPreview = document.getElementById('speech-preview');
  const transcriptText = document.getElementById('transcript-text');

  const profileBtn = document.getElementById('profile-btn');
  const profileModal = document.getElementById('profile-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const sampleBtns = document.querySelectorAll('.sample-btn');
  const offlineBanner = document.getElementById('offline-banner');

  let isRecording = false;
  let recognition = null;
  let currentUser = null;

  // Check active user session on load
  async function checkUserSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      document.getElementById('scam-count').textContent = "Authenticated";
      loadUserHistory();
    }
  }
  checkUserSession();

  // Connection Monitoring for Low Latency / Unstable Networks
  function updateOnlineStatus() {
    if (!navigator.onLine) {
      offlineBanner.classList.remove('hidden');
    } else {
      offlineBanner.classList.add('hidden');
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Tab Switching Logic
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(c => c.classList.add('hidden'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const activeTabId = `${tab.dataset.tab}-tab`;
      document.getElementById(activeTabId).classList.remove('hidden');
    });
  });

  // File Upload Display
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = e.target.files[0].name;
    } else {
      fileNameDisplay.textContent = 'No file selected';
    }
  });

  // Voice Speech Recognition Setup (Web Speech API)
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      transcriptText.textContent = transcript;
      speechPreview.classList.remove('hidden');
      analyzeVoiceBtn.classList.remove('hidden');
      stopRecording();
    };

    recognition.onerror = () => {
      micStatus.textContent = 'Error. Tap to Try Again';
      stopRecording();
    };

    recognition.onend = () => {
      stopRecording();
    };
  } else {
    micStatus.textContent = 'Voice API Not Supported';
  }

  micBtn.addEventListener('click', () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser version.');
      return;
    }
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });

  function startRecording() {
    isRecording = true;
    micBtn.classList.add('recording');
    micStatus.textContent = 'Listening...';
    try { recognition.start(); } catch (e) { console.log('Recognition already started'); }
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    if (micStatus.textContent === 'Listening...') {
      micStatus.textContent = 'Tap to Speak';
    }
  }

  // Sample Scams Pre-loading
  const sampleData = {
    bank: "ALERT: Your Chase bank account has been locked due to suspicious activity. Click http://chase-security-update.com immediately to restore access.",
    prize: "Congratulations! You have won a $1,000 Walmart Gift Card! Call +1 (800) 555-0199 now to claim your reward. Shipping fee of $5 required.",
    tech: "Hello, this is Steve calling from Microsoft Tech Support. We noticed a dangerous virus on your computer. Please download AnyDesk so I can fix it."
  };

  sampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.sample;
      textInput.value = sampleData[type];
      document.getElementById('tab-text').click();
      runAnalysis(sampleData[type], 'message');
    });
  });

  // Event Listeners for Analysis Buttons
  analyzeTextBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text && fileInput.files.length === 0) {
      alert('Please paste text or select a file to analyze.');
      return;
    }
    runAnalysis(text || `Uploaded File: ${fileInput.files[0].name}`, 'message');
  });

  analyzePhoneBtn.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    const notes = phoneNotes.value.trim();
    if (!phone) {
      alert('Please enter a phone number.');
      return;
    }
    runAnalysis(`${phone} - ${notes}`, 'phone');
  });

  analyzeVoiceBtn.addEventListener('click', () => {
    const voiceText = transcriptText.textContent;
    if (!voiceText) return;
    runAnalysis(voiceText, 'voice');
  });

  // Core Scam Analysis Engine & Supabase Logging
  async function runAnalysis(input, source) {
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth' });

    let score = 15;
    const flags = [];
    const advice = [];
    const lowerStr = input.toLowerCase();

    if (lowerStr.includes('urgent') || lowerStr.includes('alert') || lowerStr.includes('immediately') || lowerStr.includes('locked')) {
      score += 30;
      flags.push({ text: "<strong>Artificial Urgency:</strong> Scammers push you to act quickly.", level: "high" });
    }
    if (lowerStr.includes('click') || lowerStr.includes('http') || lowerStr.includes('.com') || lowerStr.includes('link')) {
      score += 25;
      flags.push({ text: "<strong>Suspicious Link / URL Detected:</strong> Phishing links clone real sites.", level: "high" });
    }
    if (lowerStr.includes('bank') || lowerStr.includes('chase') || lowerStr.includes('microsoft') || lowerStr.includes('irs')) {
      score += 20;
      flags.push({ text: "<strong>Brand Impersonation:</strong> Fake agency or bank representative.", level: "medium" });
    }
    if (lowerStr.includes('won') || lowerStr.includes('gift card') || lowerStr.includes('prize') || lowerStr.includes('fee')) {
      score += 25;
      flags.push({ text: "<strong>Too-Good-To-Be-True Offer:</strong> Upfront fees for rewards.", level: "high" });
    }

    if (flags.length === 0) {
      flags.push({ text: "<strong>No obvious automated red flags found.</strong> Stay cautious.", level: "low" });
      score = 20;
    }

    score = Math.min(score, 98);
    scoreBar.style.width = `${score}%`;
    scoreValue.textContent = `${score}%`;

    let riskLevelText = "Low Risk";
    if (score >= 70) {
      riskBadge.textContent = "High Risk Scam";
      riskBadge.className = "risk-badge high";
      scoreBar.style.backgroundColor = "var(--danger-color)";
      riskLevelText = "High";
      advice.push("Do NOT click links, reply, or share personal info.");
    } else if (score >= 40) {
      riskBadge.textContent = "Moderate Suspicion";
      riskBadge.className = "risk-badge medium";
      scoreBar.style.backgroundColor = "var(--warning-color)";
      riskLevelText = "Moderate";
      advice.push("Verify identity using official channels.");
    } else {
      riskBadge.textContent = "Likely Safe / Low Risk";
      riskBadge.className = "risk-badge low";
      scoreBar.style.backgroundColor = "var(--success-color)";
      riskLevelText = "Low";
      advice.push("Looks normal, but remain vigilant.");
    }

    breakdownList.innerHTML = flags.map(f => `<li class="flag-${f.level}">${f.text}</li>`).join('');
    adviceList.innerHTML = advice.map(a => `<li>${a}</li>`).join('');

    // Save scan result to Supabase if user is logged in
    if (currentUser) {
      await supabase.from('scan_history').insert({
        user_id: currentUser.id,
        scanned_content: input.substring(0, 250),
        scan_type: source,
        risk_score: score,
        risk_level: riskLevelText
      });
      loadUserHistory();
    }
  }

  // Profile Modal & Authentication Handlers
  profileBtn.addEventListener('click', () => {
    renderAuthUI();
    profileModal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
  window.addEventListener('click', (e) => {
    if (e.target === profileModal) profileModal.classList.add('hidden');
  });

  function renderAuthUI() {
    const modalContent = profileModal.querySelector('.modal-content');
    if (currentUser) {
      modalContent.innerHTML = `
        <button id="close-modal-btn" class="close-btn">&times;</button>
        <h3>User Profile</h3>
        <div class="profile-info">
          <p><strong>Email:</strong> ${currentUser.email}</p>
          <button id="logout-btn" class="btn btn-secondary btn-block" style="margin-top:12px;">Sign Out</button>
        </div>
        <h4>Your Past Scans</h4>
        <ul id="history-list" class="history-list">Loading history...</ul>
      `;
      document.getElementById('close-modal-btn').addEventListener('click', () => profileModal.classList.add('hidden'));
      document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        currentUser = null;
        alert('Signed out successfully.');
        profileModal.classList.add('hidden');
      });
      loadUserHistory();
    } else {
      modalContent.innerHTML = `
        <button id="close-modal-btn" class="close-btn">&times;</button>
        <h3>Sign In / Create Account</h3>
        <div class="profile-info" style="display:flex; flex-direction:column; gap:8px;">
          <input type="email" id="auth-email" placeholder="Email address" class="text-input" style="margin-bottom:0;">
          <input type="password" id="auth-password" placeholder="Password" class="text-input" style="margin-bottom:0;">
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button id="login-submit-btn" class="btn btn-primary" style="flex:1;">Sign In</button>
            <button id="signup-submit-btn" class="btn btn-outline" style="flex:1;">Register</button>
          </div>
        </div>
      `;
      document.getElementById('close-modal-btn').addEventListener('click', () => profileModal.classList.add('hidden'));
      
      document.getElementById('login-submit-btn').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else {
          currentUser = data.user;
          alert('Signed in successfully!');
          profileModal.classList.add('hidden');
        }
      });

      document.getElementById('signup-submit-btn').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
        else {
          alert('Account created! Check your email to confirm if required, or sign in.');
        }
      });
    }
  }

  async function loadUserHistory() {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (error || !data || data.length === 0) {
      historyList.innerHTML = `<li>No scan history recorded yet.</li>`;
      return;
    }

    historyList.innerHTML = data.map(scan => `
      <li><strong>[${scan.scan_type.toUpperCase()}]</strong> ${scan.scanned_content.substring(0, 35)}... — <strong>Risk: ${scan.risk_score}% (${scan.risk_level})</strong></li>
    `).join('');
  }
});

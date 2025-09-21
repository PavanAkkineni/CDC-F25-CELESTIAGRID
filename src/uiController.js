import { llamaHelper } from './llamaHelper.js';

export class UIController {
    constructor(app) {
        this.app = app;
        this.infoPanel = document.getElementById('info-panel');
        this.satelliteDataContainer = document.getElementById('satellite-data-container');
        this.debrisName = document.getElementById('debris-name');
        this.debrisCount = document.getElementById('debris-count');
        this.timeDisplay = document.getElementById('time-display');
        this.speedValue = document.getElementById('speed-value');

        // AI Assistant UI Elements
        this.aiAssistantSection = document.getElementById('ai-assistant-section');
        this.aiIntro = document.getElementById('ai-intro');
        this.chatLog = document.getElementById('chat-log');
        this.suggestedQuestions = document.getElementById('suggested-questions');
        this.chatInput = document.getElementById('chat-input');
        this.chatSendBtn = document.getElementById('chat-send');

        // Physics Info Container
        this.physicsInfoContainer = document.getElementById('physics-info-container');

        this.chatSendBtn.addEventListener('click', () => this.handleUserQuery());
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleUserQuery();
        });

        this.currentSatellite = null;
        this.satelliteInfo = null;
    }

    async showDebrisInfo(debrisData) {
        this.debrisName.textContent = debrisData.name;
        this.currentSatellite = debrisData;

        // First, display all the technical satellite data
        this.displaySatelliteData(debrisData);

        // Then, show and initialize the AI assistant section
        this.aiAssistantSection.style.display = 'block';
        this.clearChat();
        this.aiIntro.innerHTML = `<em>Contacting satellite...</em>`;

        // Fetch the document and generate AI content
        this.satelliteInfo = await llamaHelper.loadSatelliteDocument(this.currentSatellite.name);
        
        const intro = await llamaHelper.generateSatelliteIntro(this.currentSatellite, this.satelliteInfo);
        this.aiIntro.innerHTML = intro;

        const questions = await llamaHelper.generateSuggestedQuestions(this.currentSatellite, this.satelliteInfo);
        this.displaySuggestedQuestions(questions);

        // Show physics info in the main panel
        this.showPhysicsInfo(debrisData);

        // Finally, ensure the panel is visible and properly sized
        this.infoPanel.classList.remove('minimized');
        requestAnimationFrame(() => {
            this.infoPanel.classList.add('active');
        });
    }

    displaySatelliteData(debrisData) {
        const apogee = this.calculateApogee(debrisData.altitude, debrisData.eccentricity);
        const perigee = this.calculatePerigee(debrisData.altitude, debrisData.eccentricity);
        const velocity = this.calculateOrbitalVelocity(debrisData.altitude);

        this.satelliteDataContainer.innerHTML = `
            <div class="info-group">
                <h4>Identification</h4>
                <div class="info-item">
                    <span class="info-label">NORAD ID:</span>
                    <span class="info-value">${debrisData.noradId}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${debrisData.name}</span>
                </div>
            </div>
            
            <div class="info-group">
                <h4>Orbital Elements</h4>
                <div class="info-item">
                    <span class="info-label">Inclination:</span>
                    <span class="info-value">${debrisData.inclination.toFixed(2)}°</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Eccentricity:</span>
                    <span class="info-value">${debrisData.eccentricity.toFixed(6)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Mean Motion:</span>
                    <span class="info-value">${debrisData.meanMotion.toFixed(4)} rev/day</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Period:</span>
                    <span class="info-value">${this.formatPeriod(debrisData.period)}</span>
                </div>
            </div>
            
            <div class="info-group">
                <h4>Altitude Information</h4>
                <div class="info-item">
                    <span class="info-label">Mean Altitude:</span>
                    <span class="info-value">${Math.round(debrisData.altitude)} km</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Apogee:</span>
                    <span class="info-value">${Math.round(apogee)} km</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Perigee:</span>
                    <span class="info-value">${Math.round(perigee)} km</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Velocity:</span>
                    <span class="info-value">${velocity.toFixed(2)} km/s</span>
                </div>
            </div>

            <div class="info-group">
                <h4>Epoch Data</h4>
                <div class="info-item">
                    <span class="info-label">Epoch Year:</span>
                    <span class="info-value">${debrisData.epochYear}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Epoch Day:</span>
                    <span class="info-value">${debrisData.epochDay.toFixed(6)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Age:</span>
                    <span class="info-value">${this.calculateTLEAge(debrisData.epochYear, debrisData.epochDay)}</span>
                </div>
            </div>
            
            <div class="info-group">
                <h4>Classification</h4>
                <div class="info-item">
                    <span class="info-label">Orbit Type:</span>
                    <span class="info-value">${this.classifyOrbit(debrisData.altitude)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Object Type:</span>
                    <span class="info-value">${this.classifyObject(debrisData.name)}</span>
                </div>
            </div>
        `;
    }

    displaySuggestedQuestions(questions) {
        this.suggestedQuestions.innerHTML = '';
        questions.forEach(q => {
            const btn = document.createElement('button');
            btn.className = 'suggested-question';
            btn.textContent = q;
            btn.onclick = () => {
                this.chatInput.value = q;
                this.handleUserQuery();
            };
            this.suggestedQuestions.appendChild(btn);
        });
    }

    async handleUserQuery() {
        const query = this.chatInput.value.trim();
        if (!query || !this.currentSatellite) return;

        this.appendMessage(query, 'user');
        this.chatInput.value = '';

        const response = await llamaHelper.answerQuestion(query, this.currentSatellite, this.satelliteInfo);
        this.appendMessage(response, 'assistant');
    }

    showPhysicsInfo(debrisData) {
        const gravity = this.calculateGravityAtAltitude(debrisData.altitude);
        const velocity = this.calculateOrbitalVelocity(debrisData.altitude);

        this.physicsInfoContainer.innerHTML = `
            <div class="physics-info">
                <h4>🚀 Zero-G Physics at this Orbit</h4>
                <p class="physics-fact">
                    <strong>Why I feel weightless:</strong> Even though gravity here is ${gravity.percentage.toFixed(1)}% of Earth's surface gravity, I'm in continuous free-fall around Earth!
                </p>
                <div class="physics-item">
                    <span class="physics-label">Local Gravity:</span>
                    <span class="physics-value">${gravity.gravity.toFixed(2)} m/s² (${gravity.percentage.toFixed(1)}% of surface)</span>
                </div>
                <div class="physics-item">
                    <span class="physics-label">Orbital Velocity:</span>
                    <span class="physics-value">${velocity} km/s</span>
                </div>
                <div class="physics-item">
                    <span class="physics-label">Free-fall State:</span>
                    <span class="physics-value">Weightless (0G experience)</span>
                </div>
                <div class="physics-item">
                    <span class="physics-label">Orbital Period:</span>
                    <span class="physics-value">${this.formatPeriod(debrisData.period)}</span>
                </div>
                <p class="physics-note">💡 Microgravity = Gravity + Centripetal acceleration canceling each other out</p>
            </div>
        `;
    }

    calculateGravityAtAltitude(altitude) {
        const earthRadius = 6371; // km
        const surfaceGravity = 9.80665; // m/s²
        const ratio = earthRadius / (earthRadius + altitude);
        const gravityAtAltitude = surfaceGravity * Math.pow(ratio, 2);
        const gravityPercent = (gravityAtAltitude / surfaceGravity) * 100;
        
        return {
            gravity: gravityAtAltitude,
            percentage: gravityPercent
        };
    }

    appendMessage(text, sender) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${sender}-message`;
        messageEl.textContent = text;
        this.chatLog.appendChild(messageEl);
        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    }

    clearChat() {
        this.chatLog.innerHTML = '';
        this.suggestedQuestions.innerHTML = '';
        this.aiIntro.innerHTML = '';
    }

    hideInfoPanel() {
        this.infoPanel.classList.remove('active');
        this.aiAssistantSection.style.display = 'none';
    }

    updateDebrisCount(count) {
        this.debrisCount.textContent = count.toLocaleString();
    }

    updateTime(simulationTime) {
        const hours = simulationTime.getUTCHours().toString().padStart(2, '0');
        const minutes = simulationTime.getUTCMinutes().toString().padStart(2, '0');
        const seconds = simulationTime.getUTCSeconds().toString().padStart(2, '0');
        this.timeDisplay.textContent = `${hours}:${minutes}:${seconds} UTC`;
    }

    updateSpeed(speed) {
        this.speedValue.textContent = `${speed}x`;
    }

    calculateApogee(altitude, eccentricity) {
        const earthRadius = 6371;
        const semiMajorAxis = altitude + earthRadius;
        return semiMajorAxis * (1 + eccentricity) - earthRadius;
    }

    calculatePerigee(altitude, eccentricity) {
        const earthRadius = 6371;
        const semiMajorAxis = altitude + earthRadius;
        return semiMajorAxis * (1 - eccentricity) - earthRadius;
    }

    calculateOrbitalVelocity(altitude) {
        const earthRadius = 6371;
        const mu = 398600.4418; // Earth's gravitational parameter km^3/s^2
        const r = earthRadius + altitude;
        return Math.sqrt(mu / r);
    }

    formatPeriod(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.floor((minutes * 60) % 60);
        
        if (hours > 0) {
            return `${hours}h ${mins}m ${secs}s`;
        } else {
            return `${mins}m ${secs}s`;
        }
    }

    calculateTLEAge(epochYear, epochDay) {
        const epochDate = new Date(epochYear, 0, 1);
        epochDate.setDate(epochDate.getDate() + epochDay - 1);
        
        const now = new Date();
        const ageInDays = Math.floor((now - epochDate) / (1000 * 60 * 60 * 24));
        
        if (ageInDays < 1) {
            return "< 1 day";
        } else if (ageInDays === 1) {
            return "1 day";
        } else if (ageInDays < 30) {
            return `${ageInDays} days`;
        } else if (ageInDays < 365) {
            const months = Math.floor(ageInDays / 30);
            return `${months} month${months > 1 ? 's' : ''}`;
        } else {
            const years = Math.floor(ageInDays / 365);
            return `${years} year${years > 1 ? 's' : ''}`;
        }
    }

    classifyOrbit(altitude) {
        if (altitude < 2000) {
            return "Low Earth Orbit (LEO)";
        } else if (altitude < 35786) {
            return "Medium Earth Orbit (MEO)";
        } else if (altitude >= 35786 && altitude <= 36786) {
            return "Geostationary Orbit (GEO)";
        } else {
            return "High Earth Orbit (HEO)";
        }
    }

    classifyObject(name) {
        const upperName = name.toUpperCase();
        
        if (upperName.includes('DEB') || upperName.includes('DEBRIS')) {
            return "Debris Fragment";
        } else if (upperName.includes('R/B') || upperName.includes('ROCKET')) {
            return "Rocket Body";
        } else if (upperName.includes('ISS') || upperName.includes('STATION')) {
            return "Space Station";
        } else if (upperName.includes('STARLINK') || upperName.includes('ONEWEB')) {
            return "Communication Satellite";
        } else if (upperName.includes('GPS') || upperName.includes('GLONASS') || upperName.includes('GALILEO')) {
            return "Navigation Satellite";
        } else if (upperName.includes('COSMOS') || upperName.includes('USA')) {
            return "Military Satellite";
        } else if (upperName.includes('WEATHER') || upperName.includes('METEOSAT') || upperName.includes('GOES')) {
            return "Weather Satellite";
        } else if (upperName.includes('LANDSAT') || upperName.includes('SENTINEL')) {
            return "Earth Observation";
        } else if (upperName.includes('HUBBLE') || upperName.includes('SPITZER')) {
            return "Space Telescope";
        } else {
            return "Satellite";
        }
    }
}

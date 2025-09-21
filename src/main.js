import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as satellite from 'satellite.js';
import gsap from 'gsap';
import { TLEParser } from './tleParser.js';
import { Earth } from './earth.js';
import { DebrisManager } from './debrisManager.js';
import { UIController } from './uiController.js';
import { llamaHelper } from './llamaHelper.js';
import { SpatialSelector } from './spatialSelector.js';
import { CollisionDetector } from './collisionDetector.js';
import { FocusedView } from './focusedView.js';
import { Draggable } from './draggable.js';

class OrbitalDebrisVisualizer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.earth = null;
        this.debrisManager = null;
        this.uiController = null;
        this.spatialSelector = null;
        this.collisionDetector = null;
        this.focusedView = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.clock = new THREE.Clock();
        this.isPlaying = true;
        this.simulationSpeed = 1;
        this.simulationTime = new Date();
        this.baseSimulationTime = new Date();
        this.timeOffset = 0; // hours
        this.selectedDebris = null;
        this.showOrbits = true;
        this.showLabels = true;
        this.collisionMarkers = [];

        this.init();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupLighting();
        this.createEarth();
        this.setupDebrisManager();
        this.setupSpatialSelector();
        this.setupCollisionDetector();
        this.setupUI();
        this.setupEventListeners();
        this.setupDraggablePanels();
        this.loadDefaultTLE();
        this.animate();
        
        // Make app globally accessible for collision detection
        window.orbitalApp = this;

        // Initialize time controls
        this.initializeTimeControls();

        // Minimize panels by default
        this.toggleTimePanel();
        this.toggleLegendPanel();

        // Hide loading screen
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.classList.add('hidden');
        }, 2000);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        
        // Create starfield background
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 10000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 800 + Math.random() * 200;

            positions[i] = r * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = r * Math.cos(phi);

            const intensity = 0.5 + Math.random() * 0.5;
            colors[i] = intensity;
            colors[i + 1] = intensity;
            colors[i + 2] = intensity;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starMaterial = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: false
        });

        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);

        // Add subtle fog for depth
        this.scene.fog = new THREE.FogExp2(0x000000, 0.00008);
    }

    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
        this.camera.position.set(0, 100, 200);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 500;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
    }

    setupLighting() {
        // Main sunlight
        const sunLight = new THREE.DirectionalLight(0xffffff, 2);
        sunLight.position.set(100, 50, 100);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        this.scene.add(sunLight);

        // Ambient light for visibility
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambientLight);

        // Hemisphere light for realistic sky lighting
        const hemisphereLight = new THREE.HemisphereLight(0x0080ff, 0x000020, 0.3);
        this.scene.add(hemisphereLight);

        // Point light to simulate Earth's glow
        const earthGlow = new THREE.PointLight(0x4080ff, 0.5, 100);
        earthGlow.position.set(0, 0, 0);
        this.scene.add(earthGlow);
    }

    createEarth() {
        this.earth = new Earth(this.scene);
    }

    setupDebrisManager() {
        this.debrisManager = new DebrisManager(this.scene, this);
    }

    setupSpatialSelector() {
        this.spatialSelector = new SpatialSelector(this.scene, this.camera, this.renderer, this);
    }

    setupCollisionDetector() {
        this.collisionDetector = new CollisionDetector();
        this.focusedView = new FocusedView(this);
    }

    setupUI() {
        this.uiController = new UIController(this, llamaHelper);
    }

    initializeTimeControls() {
        // Set current time in datetime input
        const now = new Date();
        const localTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        document.getElementById('simulation-date').value = localTime.toISOString().slice(0, 16);
        
        // Initialize time offset display
        document.getElementById('time-offset-value').textContent = '+0 hours';
        
        // Set active preset
        document.querySelector('.time-preset-btn[data-offset="0"]').classList.add('active');
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onResize());

        // Mouse events for debris selection
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // File upload
        document.getElementById('tle-upload').addEventListener('change', (e) => this.handleFileUpload(e));

        // Control buttons
        document.getElementById('reset-view').addEventListener('click', () => this.resetView());
        document.getElementById('toggle-orbits').addEventListener('click', () => this.toggleOrbits());
        document.getElementById('toggle-labels').addEventListener('click', () => this.toggleLabels());
        document.getElementById('toggle-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('play-pause').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('speed-slider').addEventListener('input', (e) => this.updateSpeed(e));
        document.getElementById('panel-close').addEventListener('click', () => this.uiController.hideInfoPanel());
        document.getElementById('panel-minimize').addEventListener('click', () => this.toggleInfoPanel());
        document.getElementById('legend-minimize').addEventListener('click', () => this.toggleLegendPanel());
        
        // Zero-G Mode Toggle
        document.getElementById('zerog-toggle').addEventListener('click', () => this.toggleZeroGMode());


        // Time control events
        document.getElementById('time-slider').addEventListener('input', (e) => this.updateTimeOffset(e));
        document.getElementById('simulation-date').addEventListener('change', (e) => this.updateSimulationDate(e));
        document.getElementById('time-panel-toggle').addEventListener('click', () => this.toggleTimePanel());
        
        // Add click-to-restore for minimized panels (with drag detection)
        document.getElementById('time-control-panel').addEventListener('click', (e) => {
            const panel = e.target.closest('.time-control-panel');
            if (panel && panel.classList.contains('minimized') && 
                !e.target.closest('.panel-minimize') &&
                !panel.hasAttribute('data-drag-pending')) {
                this.toggleTimePanel();
            }
        });
        
        document.getElementById('info-panel').addEventListener('click', (e) => {
            const panel = e.target.closest('.info-panel');
            if (panel && panel.classList.contains('minimized') && 
                !e.target.closest('.panel-minimize') &&
                !panel.hasAttribute('data-drag-pending')) {
                this.toggleInfoPanel();
            }
        });
        
        document.getElementById('analysis-panel').addEventListener('click', (e) => {
            const panel = e.target.closest('.analysis-panel');
            if (panel && panel.classList.contains('minimized') && 
                !e.target.closest('.panel-minimize') &&
                !panel.hasAttribute('data-drag-pending')) {
                this.toggleAnalysisPanel();
            }
        });
        
        document.getElementById('legend-panel').addEventListener('click', (e) => {
            const panel = e.target.closest('.legend');
            if (panel && panel.classList.contains('minimized') && 
                !e.target.closest('.panel-minimize') &&
                !panel.hasAttribute('data-drag-pending')) {
                this.toggleLegendPanel();
            }
        });

        // Time preset buttons
        document.querySelectorAll('.time-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const offset = parseInt(e.target.getAttribute('data-offset'));
                this.setTimeOffset(offset);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.length > 0) {
                document.getElementById('search-results').classList.add('active');
            }
        });
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                document.getElementById('search-results').classList.remove('active');
            }, 200);
        });
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        
        // Also resize focused view if active
        if (this.focusedView && this.focusedView.isActive) {
            this.focusedView.onResize();
        }
    }

    onMouseClick(event) {
        // Don't handle clicks if we're in selection mode
        if (this.spatialSelector && this.spatialSelector.isSelecting) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Set raycaster to check smaller objects more accurately
        this.raycaster.params.Points.threshold = 2;

        // Check both individual debris objects and the entire debris group
        const objectsToCheck = [
            ...this.debrisManager.getDebrisObjects(),
            this.debrisManager.debrisGroup
        ];
        
        const intersects = this.raycaster.intersectObjects(objectsToCheck, true);

        if (intersects.length > 0) {
            // Find the actual debris object
            let clickedDebris = intersects[0].object;
            
            // If we hit a child object, get the parent debris
            while (clickedDebris.parent && !clickedDebris.userData.name) {
                clickedDebris = clickedDebris.parent;
            }
            
            if (clickedDebris.userData && clickedDebris.userData.name) {
                this.selectDebris(clickedDebris);
            }
        }
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.debrisManager.getDebrisObjects());

        if (intersects.length > 0) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'grab';
        }
    }

    selectDebris(debrisObject) {
        // Deselect previous
        if (this.selectedDebris) {
            this.debrisManager.deselectDebris(this.selectedDebris);
        }

        this.selectedDebris = debrisObject;
        this.debrisManager.selectDebris(debrisObject);
        
        // Get actual position of the debris
        const targetPosition = debrisObject.position.clone();
        
        // Calculate optimal camera distance based on object position
        const distanceFromCenter = targetPosition.length();
        const cameraDistance = Math.max(15, Math.min(50, distanceFromCenter * 0.3));
        
        // Position camera to look at the debris
        const direction = targetPosition.clone().normalize();
        const offset = new THREE.Vector3(
            direction.x * cameraDistance,
            direction.y * cameraDistance + 5,
            direction.z * cameraDistance
        );
        const cameraPosition = targetPosition.clone().add(offset);

        // Smooth animation to debris
        gsap.to(this.camera.position, {
            duration: 2.0,
            x: cameraPosition.x,
            y: cameraPosition.y,
            z: cameraPosition.z,
            ease: "power3.inOut"
        });

        gsap.to(this.controls.target, {
            duration: 2.0,
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z,
            ease: "power3.inOut"
        });

        // Update UI
        this.uiController.showDebrisInfo(debrisObject.userData);
    }

    resetView() {
        gsap.to(this.camera.position, {
            duration: 1.5,
            x: 0,
            y: 100,
            z: 200,
            ease: "power2.inOut"
        });

        gsap.to(this.controls.target, {
            duration: 1.5,
            x: 0,
            y: 0,
            z: 0,
            ease: "power2.inOut"
        });

        if (this.selectedDebris) {
            this.debrisManager.deselectDebris(this.selectedDebris);
            this.selectedDebris = null;
            this.uiController.hideInfoPanel();
        }
    }

    toggleOrbits() {
        this.showOrbits = !this.showOrbits;
        this.debrisManager.toggleOrbits(this.showOrbits);
        document.getElementById('toggle-orbits').classList.toggle('active');
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.debrisManager.toggleLabels(this.showLabels);
        document.getElementById('toggle-labels').classList.toggle('active');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        
        if (this.isPlaying) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        } else {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        }
    }

    updateSpeed(event) {
        this.simulationSpeed = parseFloat(event.target.value);
        document.getElementById('speed-value').textContent = `${this.simulationSpeed}x`;
    }

    handleSearch(query) {
        const results = this.debrisManager.searchDebris(query);
        const resultsContainer = document.getElementById('search-results');
        
        if (query.length === 0) {
            resultsContainer.classList.remove('active');
            resultsContainer.innerHTML = '';
            return;
        }

        resultsContainer.classList.add('active');
        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result-item">No results found</div>';
            return;
        }

        results.slice(0, 10).forEach(debris => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-name">${debris.userData.name}</div>
                <div class="search-result-id">NORAD ID: ${debris.userData.noradId}</div>
            `;
            item.addEventListener('click', () => {
                this.selectDebris(debris);
                resultsContainer.classList.remove('active');
                document.getElementById('search-input').value = '';
            });
            resultsContainer.appendChild(item);
        });
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const tleData = e.target.result;
                this.loadTLEData(tleData);
            };
            reader.readAsText(file);
        }
    }

    loadTLEData(tleData) {
        const parser = new TLEParser();
        const satellites = parser.parse(tleData);
        this.debrisManager.clearDebris();
        this.debrisManager.addDebris(satellites);
        this.uiController.updateDebrisCount(satellites.length);
    }

    async loadDefaultTLE() {
        try {
            // Load sample TLE data from public directory
            const response = await fetch('/sample-tle.txt');
            const sampleTLE = await response.text();
            this.loadTLEData(sampleTLE);
        } catch (error) {
            console.warn('Failed to load sample TLE file, using fallback data');
            // Fallback to embedded data if file load fails
            const sampleTLE = `ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9999
2 25544  51.6442 208.1234 0001234  72.1234 288.0123 15.54123456789012
COSMOS 2251 DEB
1 34427U 93036SX  24001.50000000  .00000123  00000-0  12345-4 0  9999
2 34427  74.0123 123.4567 0012345  90.1234 270.5678 14.34567890123456
STARLINK-1234
1 45678U 20012A   24001.50000000  .00001234  00000-0  23456-4 0  9999
2 45678  53.0123 234.5678 0001234 123.4567 236.7890 15.12345678901234
FENGYUN 1C DEB
1 29834U 99025DX  24001.50000000  .00000234  00000-0  34567-4 0  9999
2 29834  98.7654 345.6789 0023456 234.5678 125.4321 14.23456789012345
IRIDIUM 33 DEB
1 27432U 09002B   24001.50000000  .00000345  00000-0  45678-4 0  9999
2 27432  86.3987  45.6789 0012345 345.6789  14.3210 14.34567890123456`;
            
            this.loadTLEData(sampleTLE);
        }
    }


    onSpatialSelection(bounds) {
        console.log('Spatial selection created:', bounds);
        this.showAnalysisPanel();
        this.updateSpatialAnalysis();
    }

    onSpatialSelectionCleared() {
        this.hideAnalysisPanel();
        this.clearCollisionMarkers();
    }

    // Time control methods
    updateTimeOffset(event) {
        this.timeOffset = parseInt(event.target.value);
        this.updateSimulationTime();
        document.getElementById('time-offset-value').textContent = 
            `${this.timeOffset >= 0 ? '+' : ''}${this.timeOffset} hours`;
        
        // Update active preset button
        document.querySelectorAll('.time-preset-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.getAttribute('data-offset')) === this.timeOffset) {
                btn.classList.add('active');
            }
        });

        this.updateSpatialAnalysis();
    }

    setTimeOffset(hours) {
        this.timeOffset = hours;
        document.getElementById('time-slider').value = hours;
        document.getElementById('time-offset-value').textContent = 
            `${hours >= 0 ? '+' : ''}${hours} hours`;
        
        // Update active preset button
        document.querySelectorAll('.time-preset-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.getAttribute('data-offset')) === hours) {
                btn.classList.add('active');
            }
        });

        this.updateSimulationTime();
        this.updateSpatialAnalysis();
    }

    updateSimulationDate(event) {
        this.baseSimulationTime = new Date(event.target.value);
        this.updateSimulationTime();
        this.updateSpatialAnalysis();
    }

    updateSimulationTime() {
        this.simulationTime = new Date(
            this.baseSimulationTime.getTime() + this.timeOffset * 60 * 60 * 1000
        );
    }

    toggleTimePanel() {
        const panel = document.getElementById('time-control-panel');
        const toggle = document.getElementById('time-panel-toggle');
        
        panel.classList.toggle('minimized');
        toggle.textContent = panel.classList.contains('minimized') ? '' : '−';
    }
    
    toggleInfoPanel() {
        const panel = document.getElementById('info-panel');
        const minimize = document.getElementById('panel-minimize');
        
        panel.classList.toggle('minimized');
        minimize.textContent = panel.classList.contains('minimized') ? '' : '−';
    }

    // Analysis panel methods
    showAnalysisPanel() {
        document.getElementById('analysis-panel').classList.add('active');
    }

    hideAnalysisPanel() {
        document.getElementById('analysis-panel').classList.remove('active');
    }
    
    toggleAnalysisPanel() {
        const panel = document.getElementById('analysis-panel');
        const minimize = document.getElementById('analysis-panel-minimize');
        
        panel.classList.toggle('minimized');
        minimize.textContent = panel.classList.contains('minimized') ? '' : '−';
    }
    
    toggleLegendPanel() {
        const panel = document.getElementById('legend-panel');
        const minimize = document.getElementById('legend-minimize');
        
        panel.classList.toggle('minimized');
        minimize.textContent = panel.classList.contains('minimized') ? '' : '−';
    }
    
    toggleZeroGMode() {
        const button = document.getElementById('zerog-toggle');
        const body = document.body;
        const isActive = body.classList.contains('zerog-mode');
        
        if (isActive) {
            body.classList.remove('zerog-mode');
            button.classList.remove('active');
        } else {
            body.classList.add('zerog-mode');
            button.classList.add('active');
        }
    }
    
    setupDraggablePanels() {
        // Make all panels draggable
        const panels = [
            {
                id: 'time-control-panel',
                options: {
                    onDragStart: (element) => {
                        // Bring panel to front during drag
                        element.style.zIndex = '1000';
                    },
                    onDragEnd: (element, position) => {
                        // Reset z-index after drag
                        setTimeout(() => {
                            element.style.zIndex = '';
                        }, 100);
                    }
                }
            },
            {
                id: 'info-panel',
                options: {
                    onDragStart: (element) => {
                        element.style.zIndex = '1000';
                    },
                    onDragEnd: (element, position) => {
                        setTimeout(() => {
                            element.style.zIndex = '';
                        }, 100);
                    }
                }
            },
            {
                id: 'analysis-panel',
                options: {
                    onDragStart: (element) => {
                        element.style.zIndex = '1000';
                    },
                    onDragEnd: (element, position) => {
                        setTimeout(() => {
                            element.style.zIndex = '';
                        }, 100);
                    }
                }
            },
            {
                id: 'legend-panel',
                options: {
                    onDragStart: (element) => {
                        element.style.zIndex = '1000';
                    },
                    onDragEnd: (element, position) => {
                        setTimeout(() => {
                            element.style.zIndex = '';
                        }, 100);
                    }
                }
            }
        ];

        this.draggablePanels = [];
        
        panels.forEach(panelConfig => {
            const element = document.getElementById(panelConfig.id);
            if (element) {
                // Add draggable class
                element.classList.add('draggable-panel');
                
                // Create draggable instance
                const draggable = new Draggable(element, panelConfig.options);
                
                // Load saved position
                draggable.loadPosition();
                
                this.draggablePanels.push(draggable);
            }
        });
        
        console.log('✨ All panels are now draggable!');
    }

    updateSpatialAnalysis() {
        if (!this.spatialSelector.selectionBounds) return;

        const info = this.spatialSelector.getSelectionInfo();
        const regionInfo = document.getElementById('region-info');
        
        if (info) {
            regionInfo.innerHTML = `
                <p><strong>Center:</strong> (${info.center.x.toFixed(1)}, ${info.center.y.toFixed(1)}, ${info.center.z.toFixed(1)})</p>
                <p><strong>Dimensions:</strong> ${info.dimensions.width} × ${info.dimensions.height} × ${info.dimensions.depth}</p>
                <p><strong>Volume:</strong> ${info.volume} km³</p>
                <button id="enter-focused-view" onclick="window.orbitalApp.enterFocusedView()" style="
                    margin-top: 10px;
                    width: 100%;
                    padding: 8px;
                    background: linear-gradient(45deg, #00d9ff, #0080ff);
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                ">Enter Focused View</button>
            `;
        }

        // Update satellites in region
        const selectedSatellites = this.spatialSelector.getSelectedSatellites(
            this.debrisManager, 
            this.simulationTime
        );
        
        const satellitesList = document.getElementById('satellites-in-region');
        
        if (selectedSatellites.length === 0) {
            satellitesList.innerHTML = '<p class="no-data">No satellites in selected region at current time</p>';
        } else {
            satellitesList.innerHTML = selectedSatellites.map(sat => `
                <div class="satellite-item" onclick="window.orbitalApp.selectSatelliteByName('${sat.name}')">
                    <div class="satellite-name">${sat.name}</div>
                    <div class="satellite-details">
                        NORAD ID: ${sat.noradId} | Alt: ${Math.round(sat.altitude)} km
                    </div>
                </div>
            `).join('');
        }
    }

    selectSatelliteByName(name) {
        const debris = this.debrisManager.debrisObjects.find(d => d.userData.name === name);
        if (debris) {
            this.selectDebris(debris);
        }
    }

    // Collision analysis methods
    
    enterFocusedView() {
        if (!this.spatialSelector.selectionBounds) {
            alert('Please select a spatial region first');
            return;
        }
        
        const selectedSatellites = this.spatialSelector.getSelectedSatellites(
            this.debrisManager,
            this.simulationTime
        );
        
        if (selectedSatellites.length === 0) {
            alert('No satellites in selected region');
            return;
        }
        
        this.focusedView.enter(this.spatialSelector.selectionBounds, selectedSatellites);
    }

    runCollisionAnalysis() {
        const threshold = parseFloat(document.getElementById('collision-threshold').value);
        const windowHours = parseInt(document.getElementById('analysis-window').value);
        
        this.collisionDetector.setCollisionThreshold(threshold);
        this.collisionDetector.setAnalysisWindow(windowHours);

        const analysisButton = document.getElementById('run-collision-analysis');
        analysisButton.disabled = true;
        analysisButton.textContent = 'Analyzing...';

        const selectedSatellites = this.spatialSelector.selectionBounds ? 
            this.spatialSelector.getSelectedSatellites(this.debrisManager, this.simulationTime) :
            this.debrisManager.debrisData;

        setTimeout(() => {
            const collisions = this.collisionDetector.analyzeCollisions(
                selectedSatellites, 
                this.simulationTime,
                this.spatialSelector.selectionBounds
            );

            this.displayCollisionResults(collisions);
            this.visualizeCollisions(collisions);

            analysisButton.disabled = false;
            analysisButton.textContent = 'Run Analysis';
        }, 100);
    }

    displayCollisionResults(collisions) {
        const resultsContainer = document.getElementById('collision-results');
        
        if (collisions.length === 0) {
            resultsContainer.innerHTML = '<p class="no-data">No potential collisions detected</p>';
            return;
        }

        const report = this.collisionDetector.generateCollisionReport();
        
        resultsContainer.innerHTML = `
            <div class="collision-summary">
                <h5>Summary: ${report.total} potential collision${report.total > 1 ? 's' : ''}</h5>
                <p>Critical: ${report.byRisk.critical} | High: ${report.byRisk.high} | 
                   Medium: ${report.byRisk.medium} | Low: ${report.byRisk.low}</p>
            </div>
            ${collisions.slice(0, 10).map(collision => `
                <div class="collision-item ${collision.riskLevel.toLowerCase()}">
                    <div class="collision-header">
                        <strong>${collision.satellite1.name} ⚠️ ${collision.satellite2.name}</strong>
                        <span class="collision-risk" style="background: ${this.getRiskColor(collision.riskLevel)}">${collision.riskLevel}</span>
                    </div>
                    <div class="collision-details">
                        Time: ${collision.time.toISOString().replace('T', ' ').slice(0, 16)} UTC<br>
                        Distance: ${collision.distance.toFixed(3)} km<br>
                        Relative Velocity: ${collision.relativeVelocity.toFixed(2)} km/s
                    </div>
                </div>
            `).join('')}
            ${collisions.length > 10 ? `<p class="no-data">... and ${collisions.length - 10} more</p>` : ''}
        `;
    }

    getRiskColor(riskLevel) {
        const colors = {
            'CRITICAL': '#ff0000',
            'HIGH': '#ff6600',
            'MEDIUM': '#ffaa00',
            'LOW': '#ffff00'
        };
        return colors[riskLevel] || '#ffffff';
    }

    visualizeCollisions(collisions) {
        this.clearCollisionMarkers();
        
        collisions.slice(0, 20).forEach(collision => {
            const marker = this.collisionDetector.createCollisionVisualization(this.scene, collision);
            this.collisionMarkers.push(marker);
        });
    }

    clearCollisionMarkers() {
        this.collisionMarkers.forEach(marker => {
            this.scene.remove(marker);
        });
        this.collisionMarkers = [];
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        if (this.isPlaying) {
            // Update base simulation time
            this.baseSimulationTime = new Date(this.baseSimulationTime.getTime() + deltaTime * 1000 * this.simulationSpeed);
            this.updateSimulationTime();
            this.uiController.updateTime(this.simulationTime);

            // Update debris positions
            this.debrisManager.update(this.simulationTime);
            
            // Update spatial analysis if active
            if (this.spatialSelector.selectionBounds) {
                this.updateSpatialAnalysis();
            }
        }

        // Update Earth rotation
        this.earth.update(deltaTime * this.simulationSpeed);

        // Update controls
        this.controls.update();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new OrbitalDebrisVisualizer();
});

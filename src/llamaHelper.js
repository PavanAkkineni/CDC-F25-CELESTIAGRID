import mammoth from 'mammoth';

class LlamaHelper {
    constructor() {
        this.apiKey = '630e0bb3b0990263b9ab779ca9e80376388b627d571c1c922e72b366dbf918a8';
        this.model = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free";
        this.documentCache = new Map();
    }

    async _getLlamaResponse(prompt) {
        const fallbackModels = [
            this.model,
            "lgai/exaone-3-5-32b-instruct",
            "lgai/exaone-deep-32b",
            "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        ];

        const uniqueModels = [...new Set(fallbackModels)];

        for (const model of uniqueModels) {
            try {
                const response = await fetch("https://api.together.xyz/v1/chat/completions", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: "You are a helpful assistant who answers questions professionally and concisely." },
                            { role: "user", content: prompt }
                        ],
                        max_tokens: 300,
                        temperature: 0.7,
                        top_p: 0.7,
                        top_k: 50,
                        repetition_penalty: 1
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log("Llama Response:", data.choices[0].message.content);
                    return data.choices[0].message.content.trim();
                }
            } catch (error) {
                console.error(`Error with model ${model}:`, error);
            }
        }
        throw new Error("All attempts to query Together AI failed across all models.");
    }

    async loadSatelliteDocument(satelliteName) {
        if (this.documentCache.has(satelliteName)) {
            return this.documentCache.get(satelliteName);
        }

        try {
            const fileName = `${satelliteName}.docx`;
            const filePath = `/satelliteinfo/${fileName}`;
            
            const response = await fetch(filePath);
            if (!response.ok) {
                console.warn(`Document not found for ${satelliteName}`);
                return null;
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            const documentText = result.value;
            
            this.documentCache.set(satelliteName, documentText);
            return documentText;
        } catch (error) {
            console.error(`Error loading document for ${satelliteName}:`, error);
            return null;
        }
    }

    async generateSatelliteIntro(satelliteData, documentContent) {
        const gravity = this.calculateGravityAtAltitude(satelliteData.altitude);
        
        const prompt = `You are the satellite "${satelliteData.name}". Introduce yourself in the first person. 
                        Provide a friendly, 3-4 line introduction for a general audience.
                        Mention your purpose and one or two interesting facts based on the info below.
                        
                        Your Technical Data:
                        - Name: ${satelliteData.name}
                        - Altitude: ${satelliteData.altitude} km
                        - Orbital Period: ${satelliteData.period} minutes
                        - Gravity vs Earth: ${gravity.percentage.toFixed(1)}%
                        
                        Mission & Technical Information:
                        ${documentContent || 'No specific mission documentation available.'}`;

        try {
            return await this._getLlamaResponse(prompt);
        } catch (error) {
            console.error('Error generating satellite intro:', error);
            return `Hey! I'm ${satelliteData.name}, orbiting Earth at ${Math.round(satelliteData.altitude)} km! Even though gravity here is still ${gravity.percentage.toFixed(1)}% of what you feel on the surface, I'm in a continuous state of free-fall, which feels like zero-g. I circle the planet every ${Math.round(satelliteData.period)} minutes. Feel free to ask me anything about my mission!`;
        }
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

    async generateSuggestedQuestions(satelliteData, documentContent) {
        const prompt = `Based on the following satellite information, generate exactly 3 interesting and specific questions that someone might ask about this satellite's mission or capabilities.

Satellite: ${satelliteData.name}
${documentContent || 'Basic orbital satellite with no specific mission details available.'}

Return only the 3 questions, one per line, without numbering or additional text.`;

        try {
            const response = await this._getLlamaResponse(prompt);
            const questions = response.split('\n').filter(q => q.trim()).slice(0, 3);
            return questions.length === 3 ? questions : this.getDefaultQuestions(satelliteData);
        } catch (error) {
            console.error('Error generating suggested questions:', error);
            return this.getDefaultQuestions(satelliteData);
        }
    }

    getDefaultQuestions(satelliteData) {
        return [
            `What is the primary mission of ${satelliteData.name}?`,
            `How does my altitude of ${Math.round(satelliteData.altitude)} km affect my work?`,
            `What is special about my orbital inclination?`
        ];
    }

    async answerQuestion(question, satelliteData, documentContent) {
        const prompt = `You are ${satelliteData.name}, a satellite in space. Answer the following question in the first person, using your technical specifications and mission information.

Question: ${question}

Your Technical Data:
- Name: ${satelliteData.name}
- NORAD ID: ${satelliteData.noradId}
- Altitude: ${satelliteData.altitude} km
- Inclination: ${satelliteData.inclination}°
- Eccentricity: ${satelliteData.eccentricity}
- Orbital Period: ${satelliteData.period} minutes
- Mean Motion: ${satelliteData.meanMotion} revolutions/day
- Launch Year: ${satelliteData.epochYear}

Mission & Technical Information:
${documentContent || 'No specific mission documentation available.'}

Answer conversationally as the satellite, using "I" and "my". Be informative but friendly. If you don't have information, be honest about it.`;

        try {
            return await this._getLlamaResponse(prompt);
        } catch (error) {
            console.error('Error answering question:', error);
            return `I apologize, but I'm having trouble accessing my systems right now. Please try again in a moment.`;
        }
    }
}

export const llamaHelper = new LlamaHelper();

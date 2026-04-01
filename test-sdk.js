import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const run = async () => {
    try {
        const dummyKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || 'dummy';
        const model = createGoogleGenerativeAI({ apiKey: dummyKey })('gemini-1.5-pro-latest');
        const img = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
        const res = await generateText({
            model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Hello' },
                    { type: 'image', image: img, mimeType: 'image/png' }
                ]
            }]
        });
        console.log(res);
    } catch(e) {
        console.error("SDK Error:", e.name, e.message);
    }
};

run();

import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';

// Define types for GitHub API response
interface RepoFile {
  name: string;
  sha: string;
  type: string;
  path: string;
}

const GeminiIntegration = () => {
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState(''); // Initially empty
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [repoContent, setRepoContent] = useState<string>(''); // To hold the full repo content

  const owner = 'sujiiiiit'; // Replace with your GitHub repo owner
  const repo = 'CollabHub'; // Replace with your GitHub repo name
  const githubToken = import.meta.env.VITE_GITHUB_TOKEN; // Access GitHub token
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY; // Access Gemini API key

  // Ensure tokens are defined
  if (!githubToken) {
    console.error('GitHub token is not defined. Check your .env file.');
  }

  if (!geminiApiKey) {
    console.error('Gemini API key is not defined. Check your .env file.');
  }

  console.log(githubToken);
  console.log(geminiApiKey);

  // Fetch GitHub repo files and content
  useEffect(() => {
    const fetchRepoFiles = async () => {
      try {
        const filesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`, {
          headers: {
            Authorization: `token ${githubToken}`, // Use the GitHub token
          },
        });

        if (!filesResponse.ok) {
          throw new Error(`GitHub API responded with status ${filesResponse.status}: ${await filesResponse.text()}`);
        }

        const filesData: RepoFile[] = await filesResponse.json();
        setRepoFiles(filesData);

        // Use a smaller batch size
        const batchSize = 10;
        let fullRepoContent = '';

        for (let i = 0; i < filesData.length; i += batchSize) {
          const fileBatch = filesData.slice(i, i + batchSize);

          const batchContent = await Promise.all(fileBatch.map(async (file) => {
            if (file.type === 'file') {
              const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`, {
                headers: {
                  Authorization: `token ${githubToken}`,
                },
              });

              if (!response.ok) {
                throw new Error(`Error fetching file content: ${response.status}`);
              }

              const fileData = await response.json();
              const decodedContent = atob(fileData.content);
              return `File: ${file.name}\n\n${decodedContent}\n\n`;
            }
            return '';
          }));

          fullRepoContent += batchContent.join('\n'); // Append batch content to fullRepoContent
        }

        setRepoContent(fullRepoContent);
        setOutput(`How can I help you with this - repo ${repo}, owned by ${owner}?`);
      } catch (err) {
        console.error('Error fetching GitHub repo files:', err);
      }
    };

    fetchRepoFiles();
  }, [owner, repo, githubToken]);

  // Handle submit to send the codebase to Gemini
  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setOutput('Generating response...'); // Set output to 'Generating response...' immediately on submit

    try {
      const contents = [
        {
          role: 'user',
          parts: [
            { text: `Here is the codebase:\n\n${repoContent}\n\nNow, ${prompt}` }
          ]
        }
      ];

      const genAI = new GoogleGenerativeAI(geminiApiKey); // Use the Gemini API key
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", // or gemini-1.5-pro
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
        ],
      });

      const result = await model.generateContentStream({ contents });

      // Read from the stream and interpret the output as markdown
      const buffer: string[] = [];
      for await (let response of result.stream) {
        buffer.push(response.text());
      }

      // Set output once after collecting all responses
      setOutput(buffer.join(''));
    } catch (e) {
      console.error('Error generating content:', e);
      setOutput(e instanceof Error ? e.message : 'An unexpected error occurred');
    }
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="mb-6">
        <input
          type="text"
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your query for the code"
          className="border p-2 rounded w-full mb-4"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">Send</button>
      </form>

      <div className="output bg-gray-100 p-4 rounded-lg">
        <ReactMarkdown>{output}</ReactMarkdown>
      </div>
    </div>
  );
};
export default GeminiIntegration;


export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

async function pollTranscript(id, apiKey, maxAttempts = 20, intervalMs = 2500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${ASSEMBLYAI_BASE}/transcript/${id}`, {
      headers: { authorization: apiKey },
    });
    const data = await res.json();
    if (data.status === "completed") return data;
    if (data.status === "error") throw new Error(data.error || "AssemblyAI transcription error");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Transcription timed out — try a shorter recording.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { audioBase64 } = req.body || {};
  if (!audioBase64) {
    return res.status(400).json({ error: "Missing audio data" });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing ASSEMBLYAI_API_KEY — set it in Vercel project settings." });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");

    const uploadRes = await fetch(`${ASSEMBLYAI_BASE}/upload`, {
      method: "POST",
      headers: { authorization: apiKey },
      body: audioBuffer,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.upload_url) {
      throw new Error(uploadData.error || "Failed to upload audio to AssemblyAI");
    }

    const transcriptRes = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: uploadData.upload_url, speaker_labels: true }),
    });
    const transcriptJob = await transcriptRes.json();
    if (!transcriptRes.ok || !transcriptJob.id) {
      throw new Error(transcriptJob.error || "Failed to start transcription job");
    }

    const completed = await pollTranscript(transcriptJob.id, apiKey);

    const utterances = completed.utterances || [];
    const speakerSet = new Set();
    const formattedLines = utterances.map((u) => {
      const label = `Speaker ${u.speaker}`;
      speakerSet.add(label);
      return `${label}: ${u.text}`;
    });

    const formattedTranscript = formattedLines.length > 0 ? formattedLines.join("\n") : completed.text || "";

    return res.status(200).json({
      formattedTranscript,
      speakers: Array.from(speakerSet),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

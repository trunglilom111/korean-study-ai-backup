export function getKoreanVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") {
    return [];
  }

  return window.speechSynthesis
    .getVoices()
    .filter(
      (voice) =>
        voice.lang.toLowerCase().startsWith("ko") ||
        /korean|hangul|한국/i.test(voice.name)
    );
}

export function getKoreanVoice(voiceName?: string): SpeechSynthesisVoice | undefined {
  const voices = getKoreanVoices();

  return (
    voices.find((voice) => voice.name === voiceName) ||
    voices.find((voice) => voice.default) ||
    voices[0]
  );
}

export function speakKorean(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    voiceName?: string;
    onEnd?: () => void;
    onError?: () => void;
  }
): () => void {
  if (typeof window === "undefined" || !text.trim()) {
    return () => undefined;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  const koreanVoice = getKoreanVoice(options?.voiceName);

  utterance.lang = "ko-KR";
  utterance.rate = options?.rate ?? 0.9;
  utterance.pitch = options?.pitch ?? 1;

  if (koreanVoice) {
    utterance.voice = koreanVoice;
  }

  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }

  if (options?.onError) {
    utterance.onerror = options.onError;
  }

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

export function preloadSpeechVoices(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.speechSynthesis.getVoices();

  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

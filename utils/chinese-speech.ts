export function getChineseVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const voices = window.speechSynthesis.getVoices();

  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ||
    voices.find((voice) => /chinese|mandarin|中文|普通话/i.test(voice.name))
  );
}

export function speakChinese(text: string, rate = 0.78): void {
  if (typeof window === "undefined" || !text.trim()) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  const chineseVoice = getChineseVoice();

  utterance.lang = "zh-CN";
  utterance.rate = rate;

  if (chineseVoice) {
    utterance.voice = chineseVoice;
  }

  window.speechSynthesis.speak(utterance);
}

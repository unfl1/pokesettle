// Original fan-test content. These mappings are playful interpretations, not Pokémon lore or a clinical assessment.
export const axes = [
  { letters: ['E', 'I'], labels: ['함께 충전', '혼자 충전'], descriptions: ['동료와 함께할 때 모험이 더 즐거워요.', '나만의 시간을 보낸 뒤 모험에 집중해요.'] },
  { letters: ['S', 'N'], labels: ['경험 중심', '상상 중심'], descriptions: ['직접 보고 익힌 경험을 믿어요.', '아직 가보지 않은 가능성이 궁금해요.'] },
  { letters: ['T', 'F'], labels: ['판단 중심', '마음 중심'], descriptions: ['선택의 이유와 효율을 먼저 살펴봐요.', '동료의 기분과 관계를 먼저 살펴봐요.'] },
  { letters: ['J', 'P'], labels: ['계획대로', '흐름대로'], descriptions: ['준비한 계획을 하나씩 이루는 게 좋아요.', '상황에 맞게 새로운 길을 고르는 게 좋아요.'] },
] as const;

// Three binary questions per axis prevent ties; every answer contributes once.
export const questions = [
  { axis: 0, text: '새로운 마을에 도착했다! 가장 먼저 할 일은?', answers: ['광장에 가서 트레이너들에게 말을 건다.', '조용히 마을을 둘러보며 분위기를 익힌다.'] },
  { axis: 1, text: '처음 보는 포켓몬을 만났을 때 나는?', answers: ['생김새와 움직임을 자세히 관찰한다.', '어떤 모험을 함께할 수 있을지 상상한다.'] },
  { axis: 2, text: '친구가 배틀에서 지고 풀이 죽었다면?', answers: ['다음에 이길 방법을 같이 찾아본다.', '속상한 마음부터 들어 준다.'] },
  { axis: 3, text: '내일은 새로운 지역으로 떠나는 날!', answers: ['지도와 가방을 미리 확인해 둔다.', '필요한 것만 챙기고 발길 닿는 대로 간다.'] },
  { axis: 0, text: '긴 모험 끝에 쉬는 날이 생겼다.', answers: ['친구들을 불러 오늘 있었던 일을 나눈다.', '파트너와 한적한 곳에서 푹 쉰다.'] },
  { axis: 1, text: '체육관에 도전하기 전, 더 끌리는 준비는?', answers: ['익숙한 기술과 연습한 패턴을 점검한다.', '아무도 예상 못 할 새로운 조합을 떠올린다.'] },
  { axis: 2, text: '모험 도중 팀의 의견이 갈렸다.', answers: ['각 방법의 장단점을 비교해 결정한다.', '모두가 어떤 마음인지 먼저 물어본다.'] },
  { axis: 3, text: '가던 길에서 신기한 동굴을 발견했다!', answers: ['오늘 일정을 마치고 탐험할 시간을 잡는다.', '지금이 기회! 잠깐 들어가 본다.'] },
  { axis: 0, text: '포켓몬 캠프에서 저녁을 먹는다면?', answers: ['여럿이 둘러앉아 시끌벅적하게 먹는다.', '마음 맞는 소수와 오붓하게 먹는다.'] },
  { axis: 1, text: '새로운 기술을 배우는 나만의 방식은?', answers: ['시범을 보고 직접 반복하며 익힌다.', '원리를 생각하고 다른 활용법을 찾는다.'] },
  { axis: 2, text: '마지막 배지에 도전할 파트너를 고를 때는?', answers: ['상대와의 상성을 고려해 선택한다.', '지금까지 함께 고생한 파트너를 떠올린다.'] },
  { axis: 3, text: '모험 노트를 펼치면 어떤 모습일까?', answers: ['다음 목적지와 할 일이 정리되어 있다.', '그날그날 발견한 것들이 자유롭게 적혀 있다.'] },
] as const;

export const profiles = {
  ESTJ: { pokemon: '거북왕', title: '든든한 원정대장', pokemonId: 9 },
  ESTP: { pokemon: '리자몽', title: '일단 출발하는 도전자', pokemonId: 6 },
  ESFJ: { pokemon: '해피너스', title: '모두를 챙기는 캠프장', pokemonId: 242 },
  ESFP: { pokemon: '피카츄', title: '모험의 분위기 메이커', pokemonId: 25 },
  ENTJ: { pokemon: '한카리아스', title: '목표를 향한 개척자', pokemonId: 445 },
  ENTP: { pokemon: '팬텀', title: '예측 불가 아이디어 뱅크', pokemonId: 94 },
  ENFJ: { pokemon: '망나뇽', title: '함께 날아가는 리더', pokemonId: 149 },
  ENFP: { pokemon: '이브이', title: '가능성을 찾는 모험가', pokemonId: 133 },
  ISTJ: { pokemon: '메타그로스', title: '빈틈없이 준비하는 설계자', pokemonId: 376 },
  ISTP: { pokemon: '개굴닌자', title: '조용히 해결하는 실력자', pokemonId: 658 },
  ISFJ: { pokemon: '이상해꽃', title: '곁을 지키는 쉼터', pokemonId: 3 },
  ISFP: { pokemon: '잠만보', title: '내 속도로 걷는 여행자', pokemonId: 143 },
  INTJ: { pokemon: '뮤츠', title: '멀리 내다보는 전략가', pokemonId: 150 },
  INTP: { pokemon: '후딘', title: '궁금한 건 끝까지 연구자', pokemonId: 65 },
  INFJ: { pokemon: '가디안', title: '마음을 읽는 길잡이', pokemonId: 282 },
  INFP: { pokemon: '뮤', title: '나만의 세계를 품은 몽상가', pokemonId: 151 },
} as const;
export type PobtiType = keyof typeof profiles;
export function isPobtiType(value: string | null): value is PobtiType {
  return value !== null && Object.hasOwn(profiles, value);
}
export function calculateType(answers: readonly number[]): PobtiType {
  if (answers.length !== questions.length || answers.some(answer => answer !== 0 && answer !== 1)) {
    throw new Error('All twelve questions require a valid answer.');
  }
  return axes.map((axis, axisIndex) => {
    const votes = questions.reduce((sum, question, index) => sum + (question.axis === axisIndex && answers[index] === 0 ? 1 : 0), 0);
    return axis.letters[votes >= 2 ? 0 : 1];
  }).join('') as PobtiType;
}

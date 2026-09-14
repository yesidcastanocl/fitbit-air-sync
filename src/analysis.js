// Training plan: Yesid Castaño — definición
const TRAINING_PLAN = {
  1: { muscles: 'Hombro + Tríceps',    lissMinutes: 45 },
  2: { muscles: 'Espalda + Pectoral',  lissMinutes: 40 },
  3: { muscles: 'Hombro + Abdomen',    lissMinutes: 30 },
  4: { muscles: 'Pierna + Bíceps',     lissMinutes: 45 },
  5: { muscles: 'Hombro + Abdomen',    lissMinutes: 50 },
  6: { muscles: 'Descanso',            lissMinutes: 0  },
  0: { muscles: 'Descanso',            lissMinutes: 0  },
};

const PROFILE = {
  tmb: 1556,
  maintenance: 2450,
  deficitTarget: 1850, // midpoint of 1845-1856
};

function getTodayPlan() {
  const dow = new Date().getDay(); // 0=Sun, 1=Mon...
  return { ...TRAINING_PLAN[dow], dayOfWeek: dow };
}

function calcRecoveryScore(sleepData) {
  if (!sleepData?.dataPoints?.length) return { score: 0, label: 'Sin datos de sueño' };

  const point = sleepData.dataPoints[0];
  const summary = point?.sleep?.summary ?? {};
  const totalMin = summary.minutesAsleep ?? 0;
  const deepMin  = summary.deepSleepMinutes ?? 0;
  const remMin   = summary.remSleepMinutes ?? 0;

  // Scoring: total (max 40), deep (max 35), REM (max 25)
  const totalScore = Math.min(40, Math.round((totalMin / 480) * 40)); // 8h = perfect
  const deepScore  = Math.min(35, Math.round((deepMin  / 90)  * 35)); // 90 min deep = perfect
  const remScore   = Math.min(25, Math.round((remMin   / 90)  * 25)); // 90 min REM = perfect

  const score = totalScore + deepScore + remScore;

  let label;
  if (score >= 85) label = 'Recuperación óptima';
  else if (score >= 65) label = 'Recuperación buena';
  else if (score >= 45) label = 'Recuperación moderada';
  else label = 'Recuperación insuficiente';

  return {
    score,
    label,
    totalMinutes: totalMin,
    deepMinutes: deepMin,
    remMinutes: remMin,
    totalHours: (totalMin / 60).toFixed(1),
  };
}

function calcStepsScore(stepsData) {
  const total = (stepsData?.dataPoints ?? [])
    .reduce((sum, p) => sum + (p.steps?.count ?? 0), 0);

  let label;
  if (total >= 10000) label = 'Excelente';
  else if (total >= 7500) label = 'Bueno';
  else if (total >= 5000) label = 'Moderado';
  else label = 'Bajo';

  return { total, label };
}

function calcLISS(exerciseData, requiredMinutes) {
  if (requiredMinutes === 0) return { required: 0, completed: 0, done: true };

  // LISS = cardio activities (walking, cycling, elliptical, etc.)
  const CARDIO_TYPES = ['WALKING', 'RUNNING', 'CYCLING', 'ELLIPTICAL', 'SWIMMING', 'AEROBIC_WORKOUT'];
  const sessions = (exerciseData?.dataPoints ?? []).filter(p => {
    const type = p.exercise?.exerciseType ?? '';
    return CARDIO_TYPES.includes(type.toUpperCase());
  });

  const completedMinutes = sessions.reduce((sum, p) => {
    const start = new Date(p.exercise?.interval?.civilStartTime ?? 0);
    const end   = new Date(p.exercise?.interval?.civilEndTime   ?? 0);
    return sum + Math.round((end - start) / 60000);
  }, 0);

  return {
    required: requiredMinutes,
    completed: completedMinutes,
    done: completedMinutes >= requiredMinutes,
    sessions: sessions.length,
  };
}

function buildRecommendation({ recovery, steps, liss, plan }) {
  const lines = [];

  if (plan.dayOfWeek === 0 || plan.dayOfWeek === 6) {
    lines.push('Hoy es día de descanso — prioriza recuperación activa y nutrición.');
  } else {
    lines.push(`Entrenamiento de hoy: ${plan.muscles}.`);
  }

  if (recovery.score < 45) {
    lines.push('Sueño insuficiente — considera reducir la intensidad del entrenamiento hoy.');
  } else if (recovery.score >= 85) {
    lines.push('Recuperación óptima — puedes entrenar a máxima intensidad.');
  }

  if (plan.lissMinutes > 0 && !liss.done) {
    const remaining = liss.required - liss.completed;
    lines.push(`LISS pendiente: ${remaining} min (completado ${liss.completed}/${liss.required} min).`);
  } else if (plan.lissMinutes > 0 && liss.done) {
    lines.push('LISS completado ✓');
  }

  if (steps.total < 7500) {
    lines.push('Pasos bajos — caminar más ayuda al déficit calórico.');
  }

  lines.push(`Calorías objetivo: ${PROFILE.deficitTarget} kcal (déficit de ${PROFILE.maintenance - PROFILE.deficitTarget} kcal).`);

  return lines.join(' ');
}

function analyzeToday({ steps, sleep, exercise }) {
  const plan     = getTodayPlan();
  const recovery = calcRecoveryScore(sleep);
  const stepsRes = calcStepsScore(steps);
  const liss     = calcLISS(exercise, plan.lissMinutes);
  const recommendation = buildRecommendation({ recovery, steps: stepsRes, liss, plan });

  return {
    plan,
    recovery,
    steps: stepsRes,
    liss,
    nutrition: {
      tmb: PROFILE.tmb,
      maintenance: PROFILE.maintenance,
      deficitTarget: PROFILE.deficitTarget,
      deficit: PROFILE.maintenance - PROFILE.deficitTarget,
    },
    recommendation,
  };
}

module.exports = { analyzeToday, getTodayPlan };

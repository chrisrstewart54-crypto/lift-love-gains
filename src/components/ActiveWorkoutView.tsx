import { useState } from 'react';
import { useWorkout } from '@/context/WorkoutContext';
import { Search, Plus, Minus, Trash2, ChevronDown, ChevronUp, History, Check, X, Save, BookOpen } from 'lucide-react';
import RestTimer from './RestTimer';

interface ActiveWorkoutViewProps {
  onFinish: () => void;
}

export default function ActiveWorkoutView({ onFinish }: ActiveWorkoutViewProps) {
  const {
    exercises, activeWorkout, unit, templates,
    startWorkout, startWorkoutFromTemplate, addExerciseToWorkout, removeExerciseFromWorkout,
    addSet, updateSet, removeSet,
    finishWorkout, cancelWorkout, getLastRecord, getExerciseById,
    saveAsTemplate, deleteTemplate,
  } = useWorkout();

  const [workoutName, setWorkoutName] = useState('');
  const [search, setSearch] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [expandedLastRecord, setExpandedLastRecord] = useState<string | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());

  const completeSet = (setId: string) => {
    setCompletedSets(prev => new Set(prev).add(setId));
    setShowRestTimer(true);
  };

  if (!activeWorkout) {
    return (
      <div className="p-4 pb-24 space-y-4 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">New Workout</h1>

        {/* Templates */}
        {templates.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <BookOpen className="w-4 h-4" /> Templates
            </h2>
            {templates.map(t => (
              <div key={t.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                <button
                  onClick={() => startWorkoutFromTemplate(t.id)}
                  className="flex-1 text-left"
                >
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.exerciseIds.map(id => getExerciseById(id)?.name).filter(Boolean).join(', ')}
                  </p>
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="p-2 text-muted-foreground hover:text-destructive ml-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 border-t border-border" />
          <p className="relative text-center text-xs text-muted-foreground bg-background px-3 w-fit mx-auto">
            or start from scratch
          </p>
        </div>

        <input
          type="text"
          placeholder="Workout name (e.g. Monday Push)"
          value={workoutName}
          onChange={e => setWorkoutName(e.target.value)}
          className="w-full px-4 py-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground text-lg"
        />
        <button
          onClick={() => startWorkout(workoutName || `Workout ${new Date().toLocaleDateString()}`)}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg"
        >
          Start Workout
        </button>
      </div>
    );
  }

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    !activeWorkout.exercises.some(we => we.exerciseId === e.id)
  );

  const handleFinish = () => {
    finishWorkout();
    onFinish();
  };

  const handleSaveAsTemplate = () => {
    const name = templateName.trim() || activeWorkout.name;
    const exerciseIds = activeWorkout.exercises.map(e => e.exerciseId);
    if (exerciseIds.length > 0) {
      saveAsTemplate(name, exerciseIds);
      setShowSaveTemplate(false);
      setTemplateName('');
    }
  };

  const adjustValue = (exerciseId: string, setId: string, field: 'weight' | 'reps', delta: number) => {
    const ex = activeWorkout.exercises.find(e => e.exerciseId === exerciseId);
    const set = ex?.sets.find(s => s.id === setId);
    if (!set) return;
    const newVal = Math.max(0, set[field] + delta);
    updateSet(exerciseId, setId, field, newVal);
  };

  return (
    <div className="p-4 pb-24 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{activeWorkout.name}</h1>
        <button onClick={cancelWorkout} className="text-sm text-destructive font-medium px-3 py-1">
          Cancel
        </button>
      </div>

      {/* Exercise list */}
      {activeWorkout.exercises.map(we => {
        const exercise = getExerciseById(we.exerciseId);
        if (!exercise) return null;
        const lastRecord = getLastRecord(we.exerciseId);
        const isExpanded = expandedLastRecord === we.exerciseId;

        return (
          <div key={we.exerciseId} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex-1">
                <p className="font-semibold text-foreground">{exercise.name}</p>
                <p className="text-xs text-muted-foreground">{exercise.muscleGroup} · {exercise.equipment}</p>
              </div>
              <div className="flex items-center gap-1">
                {lastRecord && (
                  <button
                    onClick={() => setExpandedLastRecord(isExpanded ? null : we.exerciseId)}
                    className="p-2 text-accent"
                    title="View last record"
                  >
                    <History className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => removeExerciseFromWorkout(we.exerciseId)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isExpanded && lastRecord && (
              <div className="px-4 py-2 bg-muted border-b border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Last Session:</p>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {lastRecord.map(s => (
                    <span key={s.id} className="text-xs text-foreground whitespace-nowrap">
                      S{s.setNumber}: {s.weight}{unit} × {s.reps}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {we.sets.length > 0 && (
              <div className="px-3 py-2 space-y-2">
                {we.sets.map(set => (
                  <div key={set.id} className={`rounded-lg p-3 ${completedSets.has(set.id) ? 'bg-primary/10 border border-primary/30' : 'bg-muted'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Set {set.setNumber}</span>
                      <div className="flex items-center gap-1">
                        {!completedSets.has(set.id) && (
                          <button
                            onClick={() => completeSet(set.id)}
                            className="p-1 text-primary"
                            title="Complete set & start rest timer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {completedSets.has(set.id) && (
                          <span className="text-[10px] text-primary font-medium mr-1">Done</span>
                        )}
                        <button
                          onClick={() => removeSet(we.exerciseId, set.id)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Weight ({unit})</label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustValue(we.exerciseId, set.id, 'weight', -5)}
                            className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center active:bg-background shrink-0"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={set.weight || ''}
                            onChange={e => updateSet(we.exerciseId, set.id, 'weight', Number(e.target.value) || 0)}
                            className="flex-1 h-9 rounded-lg bg-background text-foreground text-center font-semibold text-sm min-w-0"
                            placeholder="0"
                          />
                          <button
                            onClick={() => adjustValue(we.exerciseId, set.id, 'weight', 5)}
                            className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center active:bg-background shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Reps</label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustValue(we.exerciseId, set.id, 'reps', -1)}
                            className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center active:bg-background shrink-0"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={set.reps || ''}
                            onChange={e => updateSet(we.exerciseId, set.id, 'reps', Number(e.target.value) || 0)}
                            className="flex-1 h-9 rounded-lg bg-background text-foreground text-center font-semibold text-sm min-w-0"
                            placeholder="0"
                          />
                          <button
                            onClick={() => adjustValue(we.exerciseId, set.id, 'reps', 1)}
                            className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center active:bg-background shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => addSet(we.exerciseId)}
              className="w-full py-3 text-sm font-medium text-primary border-t border-border flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Set
            </button>
          </div>
        );
      })}

      {/* Add exercise button */}
      <button
        onClick={() => setShowExercisePicker(!showExercisePicker)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground font-medium flex items-center justify-center gap-2"
      >
        {showExercisePicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Add Exercise
      </button>

      {/* Exercise picker */}
      {showExercisePicker && (
        <div className="bg-card rounded-xl border border-border overflow-hidden animate-slide-up">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search exercises..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredExercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => {
                  addExerciseToWorkout(ex.id);
                  setSearch('');
                }}
                className="w-full px-4 py-3 text-left flex items-center justify-between border-t border-border hover:bg-muted"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">{ex.muscleGroup} · {ex.equipment}</p>
                </div>
                <Plus className="w-4 h-4 text-primary" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save as template + Finish */}
      {activeWorkout.exercises.length > 0 && (
        <div className="space-y-2">
          {showSaveTemplate ? (
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <input
                type="text"
                placeholder={activeWorkout.name}
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAsTemplate}
                  className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium flex items-center justify-center gap-1"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                <button
                  onClick={() => setShowSaveTemplate(false)}
                  className="py-3 px-4 rounded-xl text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveTemplate(true)}
              className="w-full py-3 rounded-xl border border-border text-muted-foreground font-medium flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save as Template
            </button>
          )}

          <button
            onClick={handleFinish}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" /> Finish Workout
          </button>
        </div>
      )}
    </div>
  );
}

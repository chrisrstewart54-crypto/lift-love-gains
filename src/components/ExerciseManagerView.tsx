import { useState } from 'react';
import { useWorkout } from '@/context/WorkoutContext';
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, MuscleGroup, Equipment } from '@/types/workout';
import { Plus, Search, Trash2, X } from 'lucide-react';

export default function ExerciseManagerView() {
  const { exercises, addExercise, deleteExercise } = useWorkout();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('Chest');
  const [newEquip, setNewEquip] = useState<Equipment>('Barbell');

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.muscleGroup.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = MUSCLE_GROUPS.reduce((acc, group) => {
    const items = filtered.filter(e => e.muscleGroup === group);
    if (items.length > 0) acc[group] = items;
    return acc;
  }, {} as Record<string, typeof filtered>);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addExercise({ name: newName.trim(), muscleGroup: newMuscle, equipment: newEquip });
    setNewName('');
    setShowAdd(false);
  };

  return (
    <div className="p-4 pb-24 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Exercises</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="p-2 rounded-lg bg-primary text-primary-foreground"
        >
          {showAdd ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {showAdd && (
        <div className="bg-card rounded-xl p-4 border border-border space-y-3 animate-slide-up">
          <input
            type="text"
            placeholder="Exercise name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground text-base"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newMuscle}
              onChange={e => setNewMuscle(e.target.value as MuscleGroup)}
              className="px-3 py-3 rounded-lg bg-muted text-foreground text-sm"
            >
              {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={newEquip}
              onChange={e => setNewEquip(e.target.value as Equipment)}
              className="px-3 py-3 rounded-lg bg-muted text-foreground text-sm"
            >
              {EQUIPMENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold"
          >
            Add Exercise
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">{group}</h2>
          <div className="space-y-1">
            {items.map(ex => (
              <div key={ex.id} className="flex items-center justify-between bg-card rounded-lg px-4 py-3 border border-border">
                <div>
                  <p className="font-medium text-foreground">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">{ex.equipment}</p>
                </div>
                <button
                  onClick={() => deleteExercise(ex.id)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'lt',
  birth_year INT,
  gender TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  target_weight_kg NUMERIC,
  experience TEXT,
  goal TEXT,
  location TEXT,
  days_per_week INT,
  session_minutes INT,
  equipment TEXT[] NOT NULL DEFAULT '{}',
  limitations TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- EXERCISES (public catalog)
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_lt TEXT NOT NULL,
  name_en TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  equipment TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'both',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  instructions_lt TEXT,
  instructions_en TEXT,
  mistakes_lt TEXT,
  mistakes_en TEXT,
  video_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercises TO anon;
GRANT SELECT ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises readable" ON public.exercises FOR SELECT TO anon, authenticated USING (true);

-- PLANS
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal TEXT,
  weeks INT NOT NULL DEFAULT 8,
  days_per_week INT NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plans" ON public.plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX plans_user_idx ON public.plans(user_id, created_at DESC);

-- SESSIONS
CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans ON DELETE SET NULL,
  day_index INT,
  title TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_seconds INT,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  feeling INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.workout_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sessions_user_idx ON public.workout_sessions(user_id, started_at DESC);

-- SET LOGS
CREATE TABLE public.set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.workout_sessions ON DELETE CASCADE,
  exercise_slug TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INT NOT NULL,
  reps INT,
  weight_kg NUMERIC,
  rpe NUMERIC,
  done BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.set_logs TO authenticated;
GRANT ALL ON public.set_logs TO service_role;
ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sets" ON public.set_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX set_logs_session_idx ON public.set_logs(session_id);
CREATE INDEX set_logs_user_ex_idx ON public.set_logs(user_id, exercise_slug, created_at DESC);

-- BODY METRICS
CREATE TABLE public.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  measured_on DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC,
  body_fat NUMERIC,
  waist_cm NUMERIC,
  chest_cm NUMERIC,
  arm_cm NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_metrics TO authenticated;
GRANT ALL ON public.body_metrics TO service_role;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own metrics" ON public.body_metrics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX body_metrics_user_idx ON public.body_metrics(user_id, measured_on DESC);

-- SEED EXERCISES
INSERT INTO public.exercises (slug, name_lt, name_en, muscle_group, equipment, location, difficulty, instructions_lt, instructions_en, mistakes_lt, mistakes_en, video_key) VALUES
('squat','Pritūpimai su štanga','Barbell Back Squat','legs','barbell','gym','intermediate','Štanga ant trapecinių raumenų, pėdos pečių plotyje. Leiskitės kontroliuojamai, kol šlaunys bus lygiagrečios grindims, kelius kreipkite pėdų kryptimi, nugarą laikykite tiesią.','Bar on upper back, feet shoulder-width. Descend under control until thighs are parallel, knees tracking over toes, spine neutral.','Kelių kritimas į vidų, kulnų atsikėlimas, apvali nugara.','Knees caving in, heels rising, rounded back.','squat'),
('deadlift','Mirties trauka','Deadlift','back','barbell','gym','advanced','Štanga prie blauzdų, nugara tiesi, pečiai virš štangos. Kelkite stumdami grindis kojomis ir tiesdami klubus.','Bar over midfoot, neutral spine, shoulders above bar. Drive through the floor and extend hips.','Apvali juosmens sritis, štanga toli nuo kūno.','Rounded lower back, bar drifting away from body.','deadlift'),
('bench-press','Spaudimas gulint','Barbell Bench Press','chest','barbell','gym','intermediate','Menčių suvedimas, pėdos ant grindų. Nuleiskite štangą prie krūtinės vidurio, spauskite iki visiško alkūnių ištiesimo.','Retract shoulder blades, feet planted. Lower bar to mid-chest and press to full lockout.','Alkūnės išskėstos 90°, atsikeliantis dubuo.','Elbows flared to 90°, hips lifting off the bench.','bench-press'),
('pull-up','Prisitraukimai','Pull-Up','back','bodyweight','both','advanced','Platus laikymas, pečiai nuleisti. Traukite alkūnes žemyn, kol smakras virš skersinio.','Wide grip, shoulders down. Pull elbows to ribs until chin clears the bar.','Supimasis, nepilna amplitudė.','Swinging, partial range of motion.','pull-up'),
('push-up','Atsispaudimai','Push-Up','chest','bodyweight','home','beginner','Kūnas viena linija, alkūnės ~45° kampu. Leiskitės, kol krūtinė beveik liečia grindis.','Body in one line, elbows at ~45°. Lower until chest nearly touches the floor.','Nukarę klubai, galvos kišimas į priekį.','Sagging hips, head poking forward.','push-up'),
('plank','Lenta','Plank','core','bodyweight','home','beginner','Alkūnės po pečiais, pilvo ir sėdmenų raumenys įtempti, kūnas tiesus.','Elbows under shoulders, brace abs and glutes, body straight.','Pakeltas arba nukaręs dubuo.','Hips too high or sagging.','plank'),
('lunge','Išpuoliai','Walking Lunge','legs','bodyweight','both','beginner','Ženkite plačiai į priekį, nuleiskite užpakalinį kelį beveik iki grindų, liemuo tiesus.','Step forward, lower the back knee toward the floor, torso upright.','Per trumpas žingsnis, kelio kritimas į vidų.','Step too short, knee caving inward.','lunge'),
('overhead-press','Spaudimas virš galvos','Overhead Press','shoulders','barbell','gym','intermediate','Štanga ties raktikauliais, sėdmenys ir pilvas įtempti. Spauskite tiesiai virš galvos.','Bar at clavicles, glutes and abs braced. Press straight overhead.','Per didelis nugaros lenkimas.','Excessive lower-back arch.','overhead-press'),
('barbell-row','Irklavimas su štanga','Barbell Row','back','barbell','gym','intermediate','Liemuo ~45°, nugara tiesi. Traukite štangą prie pilvo, mentes suveskite.','Torso at ~45°, neutral spine. Row the bar to the belly, squeeze shoulder blades.','Liemens kilnojimas, trūkčiojimas.','Using momentum, torso rising.','barbell-row'),
('romanian-deadlift','Rumuniška trauka','Romanian Deadlift','legs','barbell','gym','intermediate','Kojos beveik tiesios, klubus stumkite atgal, štanga slysta palei šlaunis.','Soft knees, push hips back, bar slides along thighs.','Nugaros apvalinimas, tūpimas vietoj klubų lenkimo.','Rounding back, squatting instead of hinging.','romanian-deadlift'),
('goblet-squat','Pritūpimai su svarmeniu','Goblet Squat','legs','dumbbell','both','beginner','Svarmenį laikykite prie krūtinės, tūpkite giliai, liemuo tiesus.','Hold the weight at the chest, squat deep, torso upright.','Priekinis palinkimas.','Leaning too far forward.','goblet-squat'),
('dumbbell-press','Spaudimas su hanteliais','Dumbbell Bench Press','chest','dumbbell','both','beginner','Hanteliai virš krūtinės, nuleiskite iki krūtinės lygio, spauskite kartu.','Dumbbells above chest, lower to chest level, press together.','Per gilus nuleidimas su per dideliu svoriu.','Overstretching with too heavy weight.','dumbbell-press'),
('lat-pulldown','Viršutinės sklendės trauka','Lat Pulldown','back','machine','gym','beginner','Traukite rankeną prie krūtinės, alkūnės žemyn, liemuo beveik tiesus.','Pull the bar to the chest, elbows down, torso nearly upright.','Atsilošimas visu kūnu.','Leaning back excessively.','lat-pulldown'),
('leg-press','Kojų spaudimas','Leg Press','legs','machine','gym','beginner','Pėdos platformos viduryje, leiskite iki 90° kelių kampo.','Feet mid-platform, lower to about 90° knee bend.','Kelių fiksavimas trūkčiojant, juosmens atsikėlimas.','Locking knees harshly, lower back lifting.','leg-press'),
('burpee','Burpee','Burpee','fullbody','bodyweight','home','intermediate','Iš stovėsenos į atsispaudimą, tada šuolis aukštyn. Judesys sklandus ir ritmiškas.','From standing to a push-up, then jump up. Keep the rhythm smooth.','Nukarę klubai atsispaudime.','Sagging hips in the push-up.','burpee'),
('mountain-climber','Alpinistas','Mountain Climber','core','bodyweight','home','beginner','Lentos padėtis, greitai keiskite kelius prie krūtinės.','Plank position, drive knees to chest alternately at pace.','Kilnojami klubai.','Bouncing hips.','mountain-climber'),
('glute-bridge','Sėdmenų tiltelis','Glute Bridge','glutes','bodyweight','home','beginner','Gulint kelkite dubenį, viršuje suspauskite sėdmenis.','Lying down, lift hips and squeeze glutes at the top.','Juosmens lenkimas vietoj sėdmenų darbo.','Arching the lower back instead of using glutes.','glute-bridge'),
('hip-thrust','Klubų stūmimas','Barbell Hip Thrust','glutes','barbell','gym','intermediate','Pečiai ant suolo, štanga ant klubų, kelkite iki pilno klubų ištiesimo.','Shoulders on bench, bar over hips, drive to full hip extension.','Per didelis juosmens lenkimas viršuje.','Overarching at the top.','hip-thrust'),
('bicep-curl','Bicepso lenkimas','Dumbbell Biceps Curl','arms','dumbbell','both','beginner','Alkūnės prie liemens, kelkite kontroliuojamai, leiskite lėtai.','Elbows at your sides, curl under control, lower slowly.','Kūno supimas.','Swinging the body.','bicep-curl'),
('tricep-dip','Tricepso atsispaudimai','Triceps Dip','arms','bodyweight','both','beginner','Rankos ant suolo/lygiagrečių, leiskitės iki 90° alkūnių kampo.','Hands on bench or bars, lower to 90° elbow bend.','Pečių kėlimas prie ausų.','Shrugging shoulders up.','tricep-dip'),
('face-pull','Trauka prie veido','Face Pull','shoulders','cable','gym','beginner','Traukite virvę prie veido, alkūnės aukštai, mentes suveskite.','Pull the rope to your face, elbows high, squeeze the rear delts.','Per didelis svoris, liemens atsilošimas.','Too heavy, leaning back.','face-pull'),
('russian-twist','Rusiški sukimai','Russian Twist','core','bodyweight','home','beginner','Sėdint atsilošite, sukite liemenį iš šono į šoną.','Sit leaning back, rotate the torso side to side.','Sukimas tik rankomis.','Moving only the arms.','russian-twist'),
('jump-rope','Šokdynė','Jump Rope','cardio','other','home','beginner','Nedideli šuoliukai ant pirštų galų, riešai sukasi, alkūnės prie kūno.','Small bounces on the balls of your feet, wrists rotate, elbows in.','Per aukšti šuoliai.','Jumping too high.','jump-rope'),
('kettlebell-swing','Svarsčio mostai','Kettlebell Swing','fullbody','kettlebell','both','intermediate','Klubų lenkimas, sprogstamas klubų ištiesimas, svarstis skrieja iki krūtinės.','Hip hinge, explosive hip extension, bell floats to chest height.','Tūpimas vietoj klubų lenkimo, rankų traukimas.','Squatting instead of hinging, pulling with arms.','kettlebell-swing');
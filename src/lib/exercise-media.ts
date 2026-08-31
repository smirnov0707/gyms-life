// Master Exercise Media Library - suderinamumas ir stabilumas
export type MediaType = "video" | "frames" | "fallback";

export interface ExerciseMediaResult {
  type: MediaType;
  videoUrl?: string;
  frames?: string[];
  posterUrl?: string;
  isAvailable: boolean;
}

const VIDEO_MAP: Record<string, string> = {
  "bench-press": "/assets/videos/exercise-bench.mp4",
  "burpee": "/assets/videos/exercise-burpee.mp4",
  "deadlift": "/assets/videos/exercise-deadlift.mp4",
  "glute-bridge": "/assets/videos/exercise-glute-bridge.mp4",
  "kettlebell-swing": "/assets/videos/exercise-kettlebell.mp4",
  "lunge": "/assets/videos/exercise-lunge.mp4",
  "plank": "/assets/videos/exercise-plank.mp4",
  "pull-up": "/assets/videos/exercise-pullup.mp4",
  "push-up": "/assets/videos/exercise-pushup.mp4",
  "squat": "/assets/videos/exercise-squat.mp4",
  "kettlebell-turkish-get-up-squat-style": "/assets/exdb/kettlebell-turkish-get-up-squat-style.mp4"
};

const EXERCISE_DB_FRAMES: Record<string, string[]> = {
  "3_4_Sit-Up": [
    "/assets/exercise-db/3_4_Sit-Up/0.jpg",
    "/assets/exercise-db/3_4_Sit-Up/1.jpg"
  ],
  "90_90_Hamstring": [
    "/assets/exercise-db/90_90_Hamstring/0.jpg",
    "/assets/exercise-db/90_90_Hamstring/1.jpg"
  ],
  "Ab_Crunch_Machine": [
    "/assets/exercise-db/Ab_Crunch_Machine/0.jpg",
    "/assets/exercise-db/Ab_Crunch_Machine/1.jpg"
  ],
  "Ab_Roller": [
    "/assets/exercise-db/Ab_Roller/0.jpg",
    "/assets/exercise-db/Ab_Roller/1.jpg"
  ],
  "Adductor": [
    "/assets/exercise-db/Adductor/0.jpg",
    "/assets/exercise-db/Adductor/1.jpg"
  ],
  "Adductor_Groin": [
    "/assets/exercise-db/Adductor_Groin/0.jpg",
    "/assets/exercise-db/Adductor_Groin/1.jpg"
  ],
  "Advanced_Kettlebell_Windmill": [
    "/assets/exercise-db/Advanced_Kettlebell_Windmill/0.jpg",
    "/assets/exercise-db/Advanced_Kettlebell_Windmill/1.jpg"
  ],
  "Air_Bike": [
    "/assets/exercise-db/Air_Bike/0.jpg",
    "/assets/exercise-db/Air_Bike/1.jpg"
  ],
  "All_Fours_Quad_Stretch": [
    "/assets/exercise-db/All_Fours_Quad_Stretch/0.jpg",
    "/assets/exercise-db/All_Fours_Quad_Stretch/1.jpg"
  ],
  "Alternate_Hammer_Curl": [
    "/assets/exercise-db/Alternate_Hammer_Curl/0.jpg",
    "/assets/exercise-db/Alternate_Hammer_Curl/1.jpg"
  ],
  "Alternate_Heel_Touchers": [
    "/assets/exercise-db/Alternate_Heel_Touchers/0.jpg",
    "/assets/exercise-db/Alternate_Heel_Touchers/1.jpg"
  ],
  "Alternate_Incline_Dumbbell_Curl": [
    "/assets/exercise-db/Alternate_Incline_Dumbbell_Curl/0.jpg",
    "/assets/exercise-db/Alternate_Incline_Dumbbell_Curl/1.jpg"
  ],
  "Alternate_Leg_Diagonal_Bound": [
    "/assets/exercise-db/Alternate_Leg_Diagonal_Bound/0.jpg",
    "/assets/exercise-db/Alternate_Leg_Diagonal_Bound/1.jpg"
  ],
  "Alternating_Cable_Shoulder_Press": [
    "/assets/exercise-db/Alternating_Cable_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Alternating_Cable_Shoulder_Press/1.jpg"
  ],
  "Alternating_Deltoid_Raise": [
    "/assets/exercise-db/Alternating_Deltoid_Raise/0.jpg",
    "/assets/exercise-db/Alternating_Deltoid_Raise/1.jpg"
  ],
  "Alternating_Floor_Press": [
    "/assets/exercise-db/Alternating_Floor_Press/0.jpg",
    "/assets/exercise-db/Alternating_Floor_Press/1.jpg"
  ],
  "Alternating_Hang_Clean": [
    "/assets/exercise-db/Alternating_Hang_Clean/0.jpg",
    "/assets/exercise-db/Alternating_Hang_Clean/1.jpg"
  ],
  "Alternating_Kettlebell_Press": [
    "/assets/exercise-db/Alternating_Kettlebell_Press/0.jpg",
    "/assets/exercise-db/Alternating_Kettlebell_Press/1.jpg"
  ],
  "Alternating_Kettlebell_Row": [
    "/assets/exercise-db/Alternating_Kettlebell_Row/0.jpg",
    "/assets/exercise-db/Alternating_Kettlebell_Row/1.jpg"
  ],
  "Alternating_Renegade_Row": [
    "/assets/exercise-db/Alternating_Renegade_Row/0.jpg",
    "/assets/exercise-db/Alternating_Renegade_Row/1.jpg"
  ],
  "Ankle_Circles": [
    "/assets/exercise-db/Ankle_Circles/0.jpg",
    "/assets/exercise-db/Ankle_Circles/1.jpg"
  ],
  "Ankle_On_The_Knee": [
    "/assets/exercise-db/Ankle_On_The_Knee/0.jpg",
    "/assets/exercise-db/Ankle_On_The_Knee/1.jpg"
  ],
  "Anterior_Tibialis-SMR": [
    "/assets/exercise-db/Anterior_Tibialis-SMR/0.jpg",
    "/assets/exercise-db/Anterior_Tibialis-SMR/1.jpg"
  ],
  "Anti-Gravity_Press": [
    "/assets/exercise-db/Anti-Gravity_Press/0.jpg",
    "/assets/exercise-db/Anti-Gravity_Press/1.jpg"
  ],
  "Arm_Circles": [
    "/assets/exercise-db/Arm_Circles/0.jpg",
    "/assets/exercise-db/Arm_Circles/1.jpg"
  ],
  "Arnold_Dumbbell_Press": [
    "/assets/exercise-db/Arnold_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Arnold_Dumbbell_Press/1.jpg"
  ],
  "Around_The_Worlds": [
    "/assets/exercise-db/Around_The_Worlds/0.jpg",
    "/assets/exercise-db/Around_The_Worlds/1.jpg"
  ],
  "Atlas_Stone_Trainer": [
    "/assets/exercise-db/Atlas_Stone_Trainer/0.jpg",
    "/assets/exercise-db/Atlas_Stone_Trainer/1.jpg"
  ],
  "Atlas_Stones": [
    "/assets/exercise-db/Atlas_Stones/0.jpg",
    "/assets/exercise-db/Atlas_Stones/1.jpg"
  ],
  "Axle_Deadlift": [
    "/assets/exercise-db/Axle_Deadlift/0.jpg",
    "/assets/exercise-db/Axle_Deadlift/1.jpg"
  ],
  "Back_Flyes_-_With_Bands": [
    "/assets/exercise-db/Back_Flyes_-_With_Bands/0.jpg",
    "/assets/exercise-db/Back_Flyes_-_With_Bands/1.jpg"
  ],
  "Backward_Drag": [
    "/assets/exercise-db/Backward_Drag/0.jpg",
    "/assets/exercise-db/Backward_Drag/1.jpg"
  ],
  "Backward_Medicine_Ball_Throw": [
    "/assets/exercise-db/Backward_Medicine_Ball_Throw/0.jpg",
    "/assets/exercise-db/Backward_Medicine_Ball_Throw/1.jpg"
  ],
  "Balance_Board": [
    "/assets/exercise-db/Balance_Board/0.jpg",
    "/assets/exercise-db/Balance_Board/1.jpg"
  ],
  "Ball_Leg_Curl": [
    "/assets/exercise-db/Ball_Leg_Curl/0.jpg",
    "/assets/exercise-db/Ball_Leg_Curl/1.jpg"
  ],
  "Band_Assisted_Pull-Up": [
    "/assets/exercise-db/Band_Assisted_Pull-Up/0.jpg",
    "/assets/exercise-db/Band_Assisted_Pull-Up/1.jpg"
  ],
  "Band_Good_Morning": [
    "/assets/exercise-db/Band_Good_Morning/0.jpg",
    "/assets/exercise-db/Band_Good_Morning/1.jpg"
  ],
  "Band_Good_Morning_Pull_Through": [
    "/assets/exercise-db/Band_Good_Morning_Pull_Through/0.jpg",
    "/assets/exercise-db/Band_Good_Morning_Pull_Through/1.jpg"
  ],
  "Band_Hip_Adductions": [
    "/assets/exercise-db/Band_Hip_Adductions/0.jpg",
    "/assets/exercise-db/Band_Hip_Adductions/1.jpg"
  ],
  "Band_Pull_Apart": [
    "/assets/exercise-db/Band_Pull_Apart/0.jpg",
    "/assets/exercise-db/Band_Pull_Apart/1.jpg"
  ],
  "Band_Skull_Crusher": [
    "/assets/exercise-db/Band_Skull_Crusher/0.jpg",
    "/assets/exercise-db/Band_Skull_Crusher/1.jpg"
  ],
  "Barbell_Ab_Rollout": [
    "/assets/exercise-db/Barbell_Ab_Rollout/0.jpg",
    "/assets/exercise-db/Barbell_Ab_Rollout/1.jpg"
  ],
  "Barbell_Ab_Rollout_-_On_Knees": [
    "/assets/exercise-db/Barbell_Ab_Rollout_-_On_Knees/0.jpg",
    "/assets/exercise-db/Barbell_Ab_Rollout_-_On_Knees/1.jpg"
  ],
  "Barbell_Bench_Press_-_Medium_Grip": [
    "/assets/exercise-db/Barbell_Bench_Press_-_Medium_Grip/0.jpg",
    "/assets/exercise-db/Barbell_Bench_Press_-_Medium_Grip/1.jpg"
  ],
  "Barbell_Curl": [
    "/assets/exercise-db/Barbell_Curl/0.jpg",
    "/assets/exercise-db/Barbell_Curl/1.jpg"
  ],
  "Barbell_Curls_Lying_Against_An_Incline": [
    "/assets/exercise-db/Barbell_Curls_Lying_Against_An_Incline/0.jpg",
    "/assets/exercise-db/Barbell_Curls_Lying_Against_An_Incline/1.jpg"
  ],
  "Barbell_Deadlift": [
    "/assets/exercise-db/Barbell_Deadlift/0.jpg",
    "/assets/exercise-db/Barbell_Deadlift/1.jpg"
  ],
  "Barbell_Full_Squat": [
    "/assets/exercise-db/Barbell_Full_Squat/0.jpg",
    "/assets/exercise-db/Barbell_Full_Squat/1.jpg"
  ],
  "Barbell_Glute_Bridge": [
    "/assets/exercise-db/Barbell_Glute_Bridge/0.jpg",
    "/assets/exercise-db/Barbell_Glute_Bridge/1.jpg"
  ],
  "Barbell_Guillotine_Bench_Press": [
    "/assets/exercise-db/Barbell_Guillotine_Bench_Press/0.jpg",
    "/assets/exercise-db/Barbell_Guillotine_Bench_Press/1.jpg"
  ],
  "Barbell_Hack_Squat": [
    "/assets/exercise-db/Barbell_Hack_Squat/0.jpg",
    "/assets/exercise-db/Barbell_Hack_Squat/1.jpg"
  ],
  "Barbell_Hip_Thrust": [
    "/assets/exercise-db/Barbell_Hip_Thrust/0.jpg",
    "/assets/exercise-db/Barbell_Hip_Thrust/1.jpg"
  ],
  "Barbell_Incline_Bench_Press_-_Medium_Grip": [
    "/assets/exercise-db/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg",
    "/assets/exercise-db/Barbell_Incline_Bench_Press_-_Medium_Grip/1.jpg"
  ],
  "Barbell_Incline_Shoulder_Raise": [
    "/assets/exercise-db/Barbell_Incline_Shoulder_Raise/0.jpg",
    "/assets/exercise-db/Barbell_Incline_Shoulder_Raise/1.jpg"
  ],
  "Barbell_Lunge": [
    "/assets/exercise-db/Barbell_Lunge/0.jpg",
    "/assets/exercise-db/Barbell_Lunge/1.jpg"
  ],
  "Barbell_Rear_Delt_Row": [
    "/assets/exercise-db/Barbell_Rear_Delt_Row/0.jpg",
    "/assets/exercise-db/Barbell_Rear_Delt_Row/1.jpg"
  ],
  "Barbell_Rollout_from_Bench": [
    "/assets/exercise-db/Barbell_Rollout_from_Bench/0.jpg",
    "/assets/exercise-db/Barbell_Rollout_from_Bench/1.jpg"
  ],
  "Barbell_Seated_Calf_Raise": [
    "/assets/exercise-db/Barbell_Seated_Calf_Raise/0.jpg",
    "/assets/exercise-db/Barbell_Seated_Calf_Raise/1.jpg"
  ],
  "Barbell_Shoulder_Press": [
    "/assets/exercise-db/Barbell_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Barbell_Shoulder_Press/1.jpg"
  ],
  "Barbell_Shrug": [
    "/assets/exercise-db/Barbell_Shrug/0.jpg",
    "/assets/exercise-db/Barbell_Shrug/1.jpg"
  ],
  "Barbell_Shrug_Behind_The_Back": [
    "/assets/exercise-db/Barbell_Shrug_Behind_The_Back/0.jpg",
    "/assets/exercise-db/Barbell_Shrug_Behind_The_Back/1.jpg"
  ],
  "Barbell_Side_Bend": [
    "/assets/exercise-db/Barbell_Side_Bend/0.jpg",
    "/assets/exercise-db/Barbell_Side_Bend/1.jpg"
  ],
  "Barbell_Side_Split_Squat": [
    "/assets/exercise-db/Barbell_Side_Split_Squat/0.jpg",
    "/assets/exercise-db/Barbell_Side_Split_Squat/1.jpg"
  ],
  "Barbell_Squat": [
    "/assets/exercise-db/Barbell_Squat/0.jpg",
    "/assets/exercise-db/Barbell_Squat/1.jpg"
  ],
  "Barbell_Squat_To_A_Bench": [
    "/assets/exercise-db/Barbell_Squat_To_A_Bench/0.jpg",
    "/assets/exercise-db/Barbell_Squat_To_A_Bench/1.jpg"
  ],
  "Barbell_Step_Ups": [
    "/assets/exercise-db/Barbell_Step_Ups/0.jpg",
    "/assets/exercise-db/Barbell_Step_Ups/1.jpg"
  ],
  "Barbell_Walking_Lunge": [
    "/assets/exercise-db/Barbell_Walking_Lunge/0.jpg",
    "/assets/exercise-db/Barbell_Walking_Lunge/1.jpg"
  ],
  "Battling_Ropes": [
    "/assets/exercise-db/Battling_Ropes/0.jpg",
    "/assets/exercise-db/Battling_Ropes/1.jpg"
  ],
  "Bear_Crawl_Sled_Drags": [
    "/assets/exercise-db/Bear_Crawl_Sled_Drags/0.jpg",
    "/assets/exercise-db/Bear_Crawl_Sled_Drags/1.jpg"
  ],
  "Behind_Head_Chest_Stretch": [
    "/assets/exercise-db/Behind_Head_Chest_Stretch/0.jpg",
    "/assets/exercise-db/Behind_Head_Chest_Stretch/1.jpg"
  ],
  "Bench_Dips": [
    "/assets/exercise-db/Bench_Dips/0.jpg",
    "/assets/exercise-db/Bench_Dips/1.jpg"
  ],
  "Bench_Jump": [
    "/assets/exercise-db/Bench_Jump/0.jpg",
    "/assets/exercise-db/Bench_Jump/1.jpg"
  ],
  "Bench_Press_-_Powerlifting": [
    "/assets/exercise-db/Bench_Press_-_Powerlifting/0.jpg",
    "/assets/exercise-db/Bench_Press_-_Powerlifting/1.jpg"
  ],
  "Bench_Press_-_With_Bands": [
    "/assets/exercise-db/Bench_Press_-_With_Bands/0.jpg",
    "/assets/exercise-db/Bench_Press_-_With_Bands/1.jpg"
  ],
  "Bench_Press_with_Chains": [
    "/assets/exercise-db/Bench_Press_with_Chains/0.jpg",
    "/assets/exercise-db/Bench_Press_with_Chains/1.jpg"
  ],
  "Bench_Sprint": [
    "/assets/exercise-db/Bench_Sprint/0.jpg",
    "/assets/exercise-db/Bench_Sprint/1.jpg"
  ],
  "Bent-Arm_Barbell_Pullover": [
    "/assets/exercise-db/Bent-Arm_Barbell_Pullover/0.jpg",
    "/assets/exercise-db/Bent-Arm_Barbell_Pullover/1.jpg"
  ],
  "Bent-Arm_Dumbbell_Pullover": [
    "/assets/exercise-db/Bent-Arm_Dumbbell_Pullover/0.jpg",
    "/assets/exercise-db/Bent-Arm_Dumbbell_Pullover/1.jpg"
  ],
  "Bent-Knee_Hip_Raise": [
    "/assets/exercise-db/Bent-Knee_Hip_Raise/0.jpg",
    "/assets/exercise-db/Bent-Knee_Hip_Raise/1.jpg"
  ],
  "Bent_Over_Barbell_Row": [
    "/assets/exercise-db/Bent_Over_Barbell_Row/0.jpg",
    "/assets/exercise-db/Bent_Over_Barbell_Row/1.jpg"
  ],
  "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench": [
    "/assets/exercise-db/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench/0.jpg",
    "/assets/exercise-db/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench/1.jpg"
  ],
  "Bent_Over_Low-Pulley_Side_Lateral": [
    "/assets/exercise-db/Bent_Over_Low-Pulley_Side_Lateral/0.jpg",
    "/assets/exercise-db/Bent_Over_Low-Pulley_Side_Lateral/1.jpg"
  ],
  "Bent_Over_One-Arm_Long_Bar_Row": [
    "/assets/exercise-db/Bent_Over_One-Arm_Long_Bar_Row/0.jpg",
    "/assets/exercise-db/Bent_Over_One-Arm_Long_Bar_Row/1.jpg"
  ],
  "Bent_Over_Two-Arm_Long_Bar_Row": [
    "/assets/exercise-db/Bent_Over_Two-Arm_Long_Bar_Row/0.jpg",
    "/assets/exercise-db/Bent_Over_Two-Arm_Long_Bar_Row/1.jpg"
  ],
  "Bent_Over_Two-Dumbbell_Row": [
    "/assets/exercise-db/Bent_Over_Two-Dumbbell_Row/0.jpg",
    "/assets/exercise-db/Bent_Over_Two-Dumbbell_Row/1.jpg"
  ],
  "Bent_Over_Two-Dumbbell_Row_With_Palms_In": [
    "/assets/exercise-db/Bent_Over_Two-Dumbbell_Row_With_Palms_In/0.jpg",
    "/assets/exercise-db/Bent_Over_Two-Dumbbell_Row_With_Palms_In/1.jpg"
  ],
  "Bent_Press": [
    "/assets/exercise-db/Bent_Press/0.jpg",
    "/assets/exercise-db/Bent_Press/1.jpg"
  ],
  "Bicycling": [
    "/assets/exercise-db/Bicycling/0.jpg",
    "/assets/exercise-db/Bicycling/1.jpg"
  ],
  "Bicycling_Stationary": [
    "/assets/exercise-db/Bicycling_Stationary/0.jpg",
    "/assets/exercise-db/Bicycling_Stationary/1.jpg"
  ],
  "Board_Press": [
    "/assets/exercise-db/Board_Press/0.jpg",
    "/assets/exercise-db/Board_Press/1.jpg"
  ],
  "Body-Up": [
    "/assets/exercise-db/Body-Up/0.jpg",
    "/assets/exercise-db/Body-Up/1.jpg"
  ],
  "Body_Tricep_Press": [
    "/assets/exercise-db/Body_Tricep_Press/0.jpg",
    "/assets/exercise-db/Body_Tricep_Press/1.jpg"
  ],
  "Bodyweight_Flyes": [
    "/assets/exercise-db/Bodyweight_Flyes/0.jpg",
    "/assets/exercise-db/Bodyweight_Flyes/1.jpg"
  ],
  "Bodyweight_Mid_Row": [
    "/assets/exercise-db/Bodyweight_Mid_Row/0.jpg",
    "/assets/exercise-db/Bodyweight_Mid_Row/1.jpg"
  ],
  "Bodyweight_Squat": [
    "/assets/exercise-db/Bodyweight_Squat/0.jpg",
    "/assets/exercise-db/Bodyweight_Squat/1.jpg"
  ],
  "Bodyweight_Walking_Lunge": [
    "/assets/exercise-db/Bodyweight_Walking_Lunge/0.jpg",
    "/assets/exercise-db/Bodyweight_Walking_Lunge/1.jpg"
  ],
  "Bosu_Ball_Cable_Crunch_With_Side_Bends": [
    "/assets/exercise-db/Bosu_Ball_Cable_Crunch_With_Side_Bends/0.jpg",
    "/assets/exercise-db/Bosu_Ball_Cable_Crunch_With_Side_Bends/1.jpg"
  ],
  "Bottoms-Up_Clean_From_The_Hang_Position": [
    "/assets/exercise-db/Bottoms-Up_Clean_From_The_Hang_Position/0.jpg",
    "/assets/exercise-db/Bottoms-Up_Clean_From_The_Hang_Position/1.jpg"
  ],
  "Bottoms_Up": [
    "/assets/exercise-db/Bottoms_Up/0.jpg",
    "/assets/exercise-db/Bottoms_Up/1.jpg"
  ],
  "Box_Jump_Multiple_Response": [
    "/assets/exercise-db/Box_Jump_Multiple_Response/0.jpg",
    "/assets/exercise-db/Box_Jump_Multiple_Response/1.jpg"
  ],
  "Box_Skip": [
    "/assets/exercise-db/Box_Skip/0.jpg",
    "/assets/exercise-db/Box_Skip/1.jpg"
  ],
  "Box_Squat": [
    "/assets/exercise-db/Box_Squat/0.jpg",
    "/assets/exercise-db/Box_Squat/1.jpg"
  ],
  "Box_Squat_with_Bands": [
    "/assets/exercise-db/Box_Squat_with_Bands/0.jpg",
    "/assets/exercise-db/Box_Squat_with_Bands/1.jpg"
  ],
  "Box_Squat_with_Chains": [
    "/assets/exercise-db/Box_Squat_with_Chains/0.jpg",
    "/assets/exercise-db/Box_Squat_with_Chains/1.jpg"
  ],
  "Brachialis-SMR": [
    "/assets/exercise-db/Brachialis-SMR/0.jpg",
    "/assets/exercise-db/Brachialis-SMR/1.jpg"
  ],
  "Bradford_Rocky_Presses": [
    "/assets/exercise-db/Bradford_Rocky_Presses/0.jpg",
    "/assets/exercise-db/Bradford_Rocky_Presses/1.jpg"
  ],
  "Butt-Ups": [
    "/assets/exercise-db/Butt-Ups/0.jpg",
    "/assets/exercise-db/Butt-Ups/1.jpg"
  ],
  "Butt_Lift_Bridge": [
    "/assets/exercise-db/Butt_Lift_Bridge/0.jpg",
    "/assets/exercise-db/Butt_Lift_Bridge/1.jpg"
  ],
  "Butterfly": [
    "/assets/exercise-db/Butterfly/0.jpg",
    "/assets/exercise-db/Butterfly/1.jpg"
  ],
  "Cable_Chest_Press": [
    "/assets/exercise-db/Cable_Chest_Press/0.jpg",
    "/assets/exercise-db/Cable_Chest_Press/1.jpg"
  ],
  "Cable_Crossover": [
    "/assets/exercise-db/Cable_Crossover/0.jpg",
    "/assets/exercise-db/Cable_Crossover/1.jpg"
  ],
  "Cable_Crunch": [
    "/assets/exercise-db/Cable_Crunch/0.jpg",
    "/assets/exercise-db/Cable_Crunch/1.jpg"
  ],
  "Cable_Deadlifts": [
    "/assets/exercise-db/Cable_Deadlifts/0.jpg",
    "/assets/exercise-db/Cable_Deadlifts/1.jpg"
  ],
  "Cable_Hammer_Curls_-_Rope_Attachment": [
    "/assets/exercise-db/Cable_Hammer_Curls_-_Rope_Attachment/0.jpg",
    "/assets/exercise-db/Cable_Hammer_Curls_-_Rope_Attachment/1.jpg"
  ],
  "Cable_Hip_Adduction": [
    "/assets/exercise-db/Cable_Hip_Adduction/0.jpg",
    "/assets/exercise-db/Cable_Hip_Adduction/1.jpg"
  ],
  "Cable_Incline_Pushdown": [
    "/assets/exercise-db/Cable_Incline_Pushdown/0.jpg",
    "/assets/exercise-db/Cable_Incline_Pushdown/1.jpg"
  ],
  "Cable_Incline_Triceps_Extension": [
    "/assets/exercise-db/Cable_Incline_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Cable_Incline_Triceps_Extension/1.jpg"
  ],
  "Cable_Internal_Rotation": [
    "/assets/exercise-db/Cable_Internal_Rotation/0.jpg",
    "/assets/exercise-db/Cable_Internal_Rotation/1.jpg"
  ],
  "Cable_Iron_Cross": [
    "/assets/exercise-db/Cable_Iron_Cross/0.jpg",
    "/assets/exercise-db/Cable_Iron_Cross/1.jpg"
  ],
  "Cable_Judo_Flip": [
    "/assets/exercise-db/Cable_Judo_Flip/0.jpg",
    "/assets/exercise-db/Cable_Judo_Flip/1.jpg"
  ],
  "Cable_Lying_Triceps_Extension": [
    "/assets/exercise-db/Cable_Lying_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Cable_Lying_Triceps_Extension/1.jpg"
  ],
  "Cable_One_Arm_Tricep_Extension": [
    "/assets/exercise-db/Cable_One_Arm_Tricep_Extension/0.jpg",
    "/assets/exercise-db/Cable_One_Arm_Tricep_Extension/1.jpg"
  ],
  "Cable_Preacher_Curl": [
    "/assets/exercise-db/Cable_Preacher_Curl/0.jpg",
    "/assets/exercise-db/Cable_Preacher_Curl/1.jpg"
  ],
  "Cable_Rear_Delt_Fly": [
    "/assets/exercise-db/Cable_Rear_Delt_Fly/0.jpg",
    "/assets/exercise-db/Cable_Rear_Delt_Fly/1.jpg"
  ],
  "Cable_Reverse_Crunch": [
    "/assets/exercise-db/Cable_Reverse_Crunch/0.jpg",
    "/assets/exercise-db/Cable_Reverse_Crunch/1.jpg"
  ],
  "Cable_Rope_Overhead_Triceps_Extension": [
    "/assets/exercise-db/Cable_Rope_Overhead_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Cable_Rope_Overhead_Triceps_Extension/1.jpg"
  ],
  "Cable_Rope_Rear-Delt_Rows": [
    "/assets/exercise-db/Cable_Rope_Rear-Delt_Rows/0.jpg",
    "/assets/exercise-db/Cable_Rope_Rear-Delt_Rows/1.jpg"
  ],
  "Cable_Russian_Twists": [
    "/assets/exercise-db/Cable_Russian_Twists/0.jpg",
    "/assets/exercise-db/Cable_Russian_Twists/1.jpg"
  ],
  "Cable_Seated_Crunch": [
    "/assets/exercise-db/Cable_Seated_Crunch/0.jpg",
    "/assets/exercise-db/Cable_Seated_Crunch/1.jpg"
  ],
  "Cable_Seated_Lateral_Raise": [
    "/assets/exercise-db/Cable_Seated_Lateral_Raise/0.jpg",
    "/assets/exercise-db/Cable_Seated_Lateral_Raise/1.jpg"
  ],
  "Cable_Shoulder_Press": [
    "/assets/exercise-db/Cable_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Cable_Shoulder_Press/1.jpg"
  ],
  "Cable_Shrugs": [
    "/assets/exercise-db/Cable_Shrugs/0.jpg",
    "/assets/exercise-db/Cable_Shrugs/1.jpg"
  ],
  "Cable_Wrist_Curl": [
    "/assets/exercise-db/Cable_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Cable_Wrist_Curl/1.jpg"
  ],
  "Calf-Machine_Shoulder_Shrug": [
    "/assets/exercise-db/Calf-Machine_Shoulder_Shrug/0.jpg",
    "/assets/exercise-db/Calf-Machine_Shoulder_Shrug/1.jpg"
  ],
  "Calf_Press": [
    "/assets/exercise-db/Calf_Press/0.jpg",
    "/assets/exercise-db/Calf_Press/1.jpg"
  ],
  "Calf_Press_On_The_Leg_Press_Machine": [
    "/assets/exercise-db/Calf_Press_On_The_Leg_Press_Machine/0.jpg",
    "/assets/exercise-db/Calf_Press_On_The_Leg_Press_Machine/1.jpg"
  ],
  "Calf_Raise_On_A_Dumbbell": [
    "/assets/exercise-db/Calf_Raise_On_A_Dumbbell/0.jpg",
    "/assets/exercise-db/Calf_Raise_On_A_Dumbbell/1.jpg"
  ],
  "Calf_Raises_-_With_Bands": [
    "/assets/exercise-db/Calf_Raises_-_With_Bands/0.jpg",
    "/assets/exercise-db/Calf_Raises_-_With_Bands/1.jpg"
  ],
  "Calf_Stretch_Elbows_Against_Wall": [
    "/assets/exercise-db/Calf_Stretch_Elbows_Against_Wall/0.jpg",
    "/assets/exercise-db/Calf_Stretch_Elbows_Against_Wall/1.jpg"
  ],
  "Calf_Stretch_Hands_Against_Wall": [
    "/assets/exercise-db/Calf_Stretch_Hands_Against_Wall/0.jpg",
    "/assets/exercise-db/Calf_Stretch_Hands_Against_Wall/1.jpg"
  ],
  "Calves-SMR": [
    "/assets/exercise-db/Calves-SMR/0.jpg",
    "/assets/exercise-db/Calves-SMR/1.jpg"
  ],
  "Car_Deadlift": [
    "/assets/exercise-db/Car_Deadlift/0.jpg",
    "/assets/exercise-db/Car_Deadlift/1.jpg"
  ],
  "Car_Drivers": [
    "/assets/exercise-db/Car_Drivers/0.jpg",
    "/assets/exercise-db/Car_Drivers/1.jpg"
  ],
  "Carioca_Quick_Step": [
    "/assets/exercise-db/Carioca_Quick_Step/0.jpg",
    "/assets/exercise-db/Carioca_Quick_Step/1.jpg"
  ],
  "Cat_Stretch": [
    "/assets/exercise-db/Cat_Stretch/0.jpg",
    "/assets/exercise-db/Cat_Stretch/1.jpg"
  ],
  "Catch_and_Overhead_Throw": [
    "/assets/exercise-db/Catch_and_Overhead_Throw/0.jpg",
    "/assets/exercise-db/Catch_and_Overhead_Throw/1.jpg"
  ],
  "Chain_Handle_Extension": [
    "/assets/exercise-db/Chain_Handle_Extension/0.jpg",
    "/assets/exercise-db/Chain_Handle_Extension/1.jpg"
  ],
  "Chain_Press": [
    "/assets/exercise-db/Chain_Press/0.jpg",
    "/assets/exercise-db/Chain_Press/1.jpg"
  ],
  "Chair_Leg_Extended_Stretch": [
    "/assets/exercise-db/Chair_Leg_Extended_Stretch/0.jpg",
    "/assets/exercise-db/Chair_Leg_Extended_Stretch/1.jpg"
  ],
  "Chair_Lower_Back_Stretch": [
    "/assets/exercise-db/Chair_Lower_Back_Stretch/0.jpg",
    "/assets/exercise-db/Chair_Lower_Back_Stretch/1.jpg"
  ],
  "Chair_Squat": [
    "/assets/exercise-db/Chair_Squat/0.jpg",
    "/assets/exercise-db/Chair_Squat/1.jpg"
  ],
  "Chair_Upper_Body_Stretch": [
    "/assets/exercise-db/Chair_Upper_Body_Stretch/0.jpg",
    "/assets/exercise-db/Chair_Upper_Body_Stretch/1.jpg"
  ],
  "Chest_And_Front_Of_Shoulder_Stretch": [
    "/assets/exercise-db/Chest_And_Front_Of_Shoulder_Stretch/0.jpg",
    "/assets/exercise-db/Chest_And_Front_Of_Shoulder_Stretch/1.jpg"
  ],
  "Chest_Push_from_3_point_stance": [
    "/assets/exercise-db/Chest_Push_from_3_point_stance/0.jpg",
    "/assets/exercise-db/Chest_Push_from_3_point_stance/1.jpg"
  ],
  "Chest_Push_multiple_response": [
    "/assets/exercise-db/Chest_Push_multiple_response/0.jpg",
    "/assets/exercise-db/Chest_Push_multiple_response/1.jpg"
  ],
  "Chest_Push_single_response": [
    "/assets/exercise-db/Chest_Push_single_response/0.jpg",
    "/assets/exercise-db/Chest_Push_single_response/1.jpg"
  ],
  "Chest_Push_with_Run_Release": [
    "/assets/exercise-db/Chest_Push_with_Run_Release/0.jpg",
    "/assets/exercise-db/Chest_Push_with_Run_Release/1.jpg"
  ],
  "Chest_Stretch_on_Stability_Ball": [
    "/assets/exercise-db/Chest_Stretch_on_Stability_Ball/0.jpg",
    "/assets/exercise-db/Chest_Stretch_on_Stability_Ball/1.jpg"
  ],
  "Childs_Pose": [
    "/assets/exercise-db/Childs_Pose/0.jpg",
    "/assets/exercise-db/Childs_Pose/1.jpg"
  ],
  "Chin_To_Chest_Stretch": [
    "/assets/exercise-db/Chin_To_Chest_Stretch/0.jpg",
    "/assets/exercise-db/Chin_To_Chest_Stretch/1.jpg"
  ],
  "Circus_Bell": [
    "/assets/exercise-db/Circus_Bell/0.jpg",
    "/assets/exercise-db/Circus_Bell/1.jpg"
  ],
  "Clean": [
    "/assets/exercise-db/Clean/0.jpg",
    "/assets/exercise-db/Clean/1.jpg"
  ],
  "Clean_Deadlift": [
    "/assets/exercise-db/Clean_Deadlift/0.jpg",
    "/assets/exercise-db/Clean_Deadlift/1.jpg"
  ],
  "Clean_Pull": [
    "/assets/exercise-db/Clean_Pull/0.jpg",
    "/assets/exercise-db/Clean_Pull/1.jpg"
  ],
  "Clean_Shrug": [
    "/assets/exercise-db/Clean_Shrug/0.jpg",
    "/assets/exercise-db/Clean_Shrug/1.jpg"
  ],
  "Clean_and_Jerk": [
    "/assets/exercise-db/Clean_and_Jerk/0.jpg",
    "/assets/exercise-db/Clean_and_Jerk/1.jpg"
  ],
  "Clean_and_Press": [
    "/assets/exercise-db/Clean_and_Press/0.jpg",
    "/assets/exercise-db/Clean_and_Press/1.jpg"
  ],
  "Clean_from_Blocks": [
    "/assets/exercise-db/Clean_from_Blocks/0.jpg",
    "/assets/exercise-db/Clean_from_Blocks/1.jpg"
  ],
  "Clock_Push-Up": [
    "/assets/exercise-db/Clock_Push-Up/0.jpg",
    "/assets/exercise-db/Clock_Push-Up/1.jpg"
  ],
  "Close-Grip_Barbell_Bench_Press": [
    "/assets/exercise-db/Close-Grip_Barbell_Bench_Press/0.jpg",
    "/assets/exercise-db/Close-Grip_Barbell_Bench_Press/1.jpg"
  ],
  "Close-Grip_Dumbbell_Press": [
    "/assets/exercise-db/Close-Grip_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Close-Grip_Dumbbell_Press/1.jpg"
  ],
  "Close-Grip_EZ-Bar_Curl_with_Band": [
    "/assets/exercise-db/Close-Grip_EZ-Bar_Curl_with_Band/0.jpg",
    "/assets/exercise-db/Close-Grip_EZ-Bar_Curl_with_Band/1.jpg"
  ],
  "Close-Grip_EZ-Bar_Press": [
    "/assets/exercise-db/Close-Grip_EZ-Bar_Press/0.jpg",
    "/assets/exercise-db/Close-Grip_EZ-Bar_Press/1.jpg"
  ],
  "Close-Grip_EZ_Bar_Curl": [
    "/assets/exercise-db/Close-Grip_EZ_Bar_Curl/0.jpg",
    "/assets/exercise-db/Close-Grip_EZ_Bar_Curl/1.jpg"
  ],
  "Close-Grip_Front_Lat_Pulldown": [
    "/assets/exercise-db/Close-Grip_Front_Lat_Pulldown/0.jpg",
    "/assets/exercise-db/Close-Grip_Front_Lat_Pulldown/1.jpg"
  ],
  "Close-Grip_Push-Up_off_of_a_Dumbbell": [
    "/assets/exercise-db/Close-Grip_Push-Up_off_of_a_Dumbbell/0.jpg",
    "/assets/exercise-db/Close-Grip_Push-Up_off_of_a_Dumbbell/1.jpg"
  ],
  "Close-Grip_Standing_Barbell_Curl": [
    "/assets/exercise-db/Close-Grip_Standing_Barbell_Curl/0.jpg",
    "/assets/exercise-db/Close-Grip_Standing_Barbell_Curl/1.jpg"
  ],
  "Cocoons": [
    "/assets/exercise-db/Cocoons/0.jpg",
    "/assets/exercise-db/Cocoons/1.jpg"
  ],
  "Conans_Wheel": [
    "/assets/exercise-db/Conans_Wheel/0.jpg",
    "/assets/exercise-db/Conans_Wheel/1.jpg"
  ],
  "Concentration_Curls": [
    "/assets/exercise-db/Concentration_Curls/0.jpg",
    "/assets/exercise-db/Concentration_Curls/1.jpg"
  ],
  "Cross-Body_Crunch": [
    "/assets/exercise-db/Cross-Body_Crunch/0.jpg",
    "/assets/exercise-db/Cross-Body_Crunch/1.jpg"
  ],
  "Cross_Body_Hammer_Curl": [
    "/assets/exercise-db/Cross_Body_Hammer_Curl/0.jpg",
    "/assets/exercise-db/Cross_Body_Hammer_Curl/1.jpg"
  ],
  "Cross_Over_-_With_Bands": [
    "/assets/exercise-db/Cross_Over_-_With_Bands/0.jpg",
    "/assets/exercise-db/Cross_Over_-_With_Bands/1.jpg"
  ],
  "Crossover_Reverse_Lunge": [
    "/assets/exercise-db/Crossover_Reverse_Lunge/0.jpg",
    "/assets/exercise-db/Crossover_Reverse_Lunge/1.jpg"
  ],
  "Crucifix": [
    "/assets/exercise-db/Crucifix/0.jpg",
    "/assets/exercise-db/Crucifix/1.jpg"
  ],
  "Crunch_-_Hands_Overhead": [
    "/assets/exercise-db/Crunch_-_Hands_Overhead/0.jpg",
    "/assets/exercise-db/Crunch_-_Hands_Overhead/1.jpg"
  ],
  "Crunch_-_Legs_On_Exercise_Ball": [
    "/assets/exercise-db/Crunch_-_Legs_On_Exercise_Ball/0.jpg",
    "/assets/exercise-db/Crunch_-_Legs_On_Exercise_Ball/1.jpg"
  ],
  "Crunches": [
    "/assets/exercise-db/Crunches/0.jpg",
    "/assets/exercise-db/Crunches/1.jpg"
  ],
  "Cuban_Press": [
    "/assets/exercise-db/Cuban_Press/0.jpg",
    "/assets/exercise-db/Cuban_Press/1.jpg"
  ],
  "Dancers_Stretch": [
    "/assets/exercise-db/Dancers_Stretch/0.jpg",
    "/assets/exercise-db/Dancers_Stretch/1.jpg"
  ],
  "Dead_Bug": [
    "/assets/exercise-db/Dead_Bug/0.jpg",
    "/assets/exercise-db/Dead_Bug/1.jpg"
  ],
  "Deadlift_with_Bands": [
    "/assets/exercise-db/Deadlift_with_Bands/0.jpg",
    "/assets/exercise-db/Deadlift_with_Bands/1.jpg"
  ],
  "Deadlift_with_Chains": [
    "/assets/exercise-db/Deadlift_with_Chains/0.jpg",
    "/assets/exercise-db/Deadlift_with_Chains/1.jpg"
  ],
  "Decline_Barbell_Bench_Press": [
    "/assets/exercise-db/Decline_Barbell_Bench_Press/0.jpg",
    "/assets/exercise-db/Decline_Barbell_Bench_Press/1.jpg"
  ],
  "Decline_Close-Grip_Bench_To_Skull_Crusher": [
    "/assets/exercise-db/Decline_Close-Grip_Bench_To_Skull_Crusher/0.jpg",
    "/assets/exercise-db/Decline_Close-Grip_Bench_To_Skull_Crusher/1.jpg"
  ],
  "Decline_Crunch": [
    "/assets/exercise-db/Decline_Crunch/0.jpg",
    "/assets/exercise-db/Decline_Crunch/1.jpg"
  ],
  "Decline_Dumbbell_Bench_Press": [
    "/assets/exercise-db/Decline_Dumbbell_Bench_Press/0.jpg",
    "/assets/exercise-db/Decline_Dumbbell_Bench_Press/1.jpg"
  ],
  "Decline_Dumbbell_Flyes": [
    "/assets/exercise-db/Decline_Dumbbell_Flyes/0.jpg",
    "/assets/exercise-db/Decline_Dumbbell_Flyes/1.jpg"
  ],
  "Decline_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/Decline_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Decline_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "Decline_EZ_Bar_Triceps_Extension": [
    "/assets/exercise-db/Decline_EZ_Bar_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Decline_EZ_Bar_Triceps_Extension/1.jpg"
  ],
  "Decline_Oblique_Crunch": [
    "/assets/exercise-db/Decline_Oblique_Crunch/0.jpg",
    "/assets/exercise-db/Decline_Oblique_Crunch/1.jpg"
  ],
  "Decline_Push-Up": [
    "/assets/exercise-db/Decline_Push-Up/0.jpg",
    "/assets/exercise-db/Decline_Push-Up/1.jpg"
  ],
  "Decline_Reverse_Crunch": [
    "/assets/exercise-db/Decline_Reverse_Crunch/0.jpg",
    "/assets/exercise-db/Decline_Reverse_Crunch/1.jpg"
  ],
  "Decline_Smith_Press": [
    "/assets/exercise-db/Decline_Smith_Press/0.jpg",
    "/assets/exercise-db/Decline_Smith_Press/1.jpg"
  ],
  "Deficit_Deadlift": [
    "/assets/exercise-db/Deficit_Deadlift/0.jpg",
    "/assets/exercise-db/Deficit_Deadlift/1.jpg"
  ],
  "Depth_Jump_Leap": [
    "/assets/exercise-db/Depth_Jump_Leap/0.jpg",
    "/assets/exercise-db/Depth_Jump_Leap/1.jpg"
  ],
  "Dip_Machine": [
    "/assets/exercise-db/Dip_Machine/0.jpg",
    "/assets/exercise-db/Dip_Machine/1.jpg"
  ],
  "Dips_-_Chest_Version": [
    "/assets/exercise-db/Dips_-_Chest_Version/0.jpg",
    "/assets/exercise-db/Dips_-_Chest_Version/1.jpg"
  ],
  "Dips_-_Triceps_Version": [
    "/assets/exercise-db/Dips_-_Triceps_Version/0.jpg",
    "/assets/exercise-db/Dips_-_Triceps_Version/1.jpg"
  ],
  "Donkey_Calf_Raises": [
    "/assets/exercise-db/Donkey_Calf_Raises/0.jpg",
    "/assets/exercise-db/Donkey_Calf_Raises/1.jpg"
  ],
  "Double_Kettlebell_Alternating_Hang_Clean": [
    "/assets/exercise-db/Double_Kettlebell_Alternating_Hang_Clean/0.jpg",
    "/assets/exercise-db/Double_Kettlebell_Alternating_Hang_Clean/1.jpg"
  ],
  "Double_Kettlebell_Jerk": [
    "/assets/exercise-db/Double_Kettlebell_Jerk/0.jpg",
    "/assets/exercise-db/Double_Kettlebell_Jerk/1.jpg"
  ],
  "Double_Kettlebell_Push_Press": [
    "/assets/exercise-db/Double_Kettlebell_Push_Press/0.jpg",
    "/assets/exercise-db/Double_Kettlebell_Push_Press/1.jpg"
  ],
  "Double_Kettlebell_Snatch": [
    "/assets/exercise-db/Double_Kettlebell_Snatch/0.jpg",
    "/assets/exercise-db/Double_Kettlebell_Snatch/1.jpg"
  ],
  "Double_Kettlebell_Windmill": [
    "/assets/exercise-db/Double_Kettlebell_Windmill/0.jpg",
    "/assets/exercise-db/Double_Kettlebell_Windmill/1.jpg"
  ],
  "Double_Leg_Butt_Kick": [
    "/assets/exercise-db/Double_Leg_Butt_Kick/0.jpg",
    "/assets/exercise-db/Double_Leg_Butt_Kick/1.jpg"
  ],
  "Downward_Facing_Balance": [
    "/assets/exercise-db/Downward_Facing_Balance/0.jpg",
    "/assets/exercise-db/Downward_Facing_Balance/1.jpg"
  ],
  "Drag_Curl": [
    "/assets/exercise-db/Drag_Curl/0.jpg",
    "/assets/exercise-db/Drag_Curl/1.jpg"
  ],
  "Drop_Push": [
    "/assets/exercise-db/Drop_Push/0.jpg",
    "/assets/exercise-db/Drop_Push/1.jpg"
  ],
  "Dumbbell_Alternate_Bicep_Curl": [
    "/assets/exercise-db/Dumbbell_Alternate_Bicep_Curl/0.jpg",
    "/assets/exercise-db/Dumbbell_Alternate_Bicep_Curl/1.jpg"
  ],
  "Dumbbell_Bench_Press": [
    "/assets/exercise-db/Dumbbell_Bench_Press/0.jpg",
    "/assets/exercise-db/Dumbbell_Bench_Press/1.jpg"
  ],
  "Dumbbell_Bench_Press_with_Neutral_Grip": [
    "/assets/exercise-db/Dumbbell_Bench_Press_with_Neutral_Grip/0.jpg",
    "/assets/exercise-db/Dumbbell_Bench_Press_with_Neutral_Grip/1.jpg"
  ],
  "Dumbbell_Bicep_Curl": [
    "/assets/exercise-db/Dumbbell_Bicep_Curl/0.jpg",
    "/assets/exercise-db/Dumbbell_Bicep_Curl/1.jpg"
  ],
  "Dumbbell_Clean": [
    "/assets/exercise-db/Dumbbell_Clean/0.jpg",
    "/assets/exercise-db/Dumbbell_Clean/1.jpg"
  ],
  "Dumbbell_Floor_Press": [
    "/assets/exercise-db/Dumbbell_Floor_Press/0.jpg",
    "/assets/exercise-db/Dumbbell_Floor_Press/1.jpg"
  ],
  "Dumbbell_Flyes": [
    "/assets/exercise-db/Dumbbell_Flyes/0.jpg",
    "/assets/exercise-db/Dumbbell_Flyes/1.jpg"
  ],
  "Dumbbell_Incline_Row": [
    "/assets/exercise-db/Dumbbell_Incline_Row/0.jpg",
    "/assets/exercise-db/Dumbbell_Incline_Row/1.jpg"
  ],
  "Dumbbell_Incline_Shoulder_Raise": [
    "/assets/exercise-db/Dumbbell_Incline_Shoulder_Raise/0.jpg",
    "/assets/exercise-db/Dumbbell_Incline_Shoulder_Raise/1.jpg"
  ],
  "Dumbbell_Lunges": [
    "/assets/exercise-db/Dumbbell_Lunges/0.jpg",
    "/assets/exercise-db/Dumbbell_Lunges/1.jpg"
  ],
  "Dumbbell_Lying_One-Arm_Rear_Lateral_Raise": [
    "/assets/exercise-db/Dumbbell_Lying_One-Arm_Rear_Lateral_Raise/0.jpg",
    "/assets/exercise-db/Dumbbell_Lying_One-Arm_Rear_Lateral_Raise/1.jpg"
  ],
  "Dumbbell_Lying_Pronation": [
    "/assets/exercise-db/Dumbbell_Lying_Pronation/0.jpg",
    "/assets/exercise-db/Dumbbell_Lying_Pronation/1.jpg"
  ],
  "Dumbbell_Lying_Rear_Lateral_Raise": [
    "/assets/exercise-db/Dumbbell_Lying_Rear_Lateral_Raise/0.jpg",
    "/assets/exercise-db/Dumbbell_Lying_Rear_Lateral_Raise/1.jpg"
  ],
  "Dumbbell_Lying_Supination": [
    "/assets/exercise-db/Dumbbell_Lying_Supination/0.jpg",
    "/assets/exercise-db/Dumbbell_Lying_Supination/1.jpg"
  ],
  "Dumbbell_One-Arm_Shoulder_Press": [
    "/assets/exercise-db/Dumbbell_One-Arm_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Dumbbell_One-Arm_Shoulder_Press/1.jpg"
  ],
  "Dumbbell_One-Arm_Triceps_Extension": [
    "/assets/exercise-db/Dumbbell_One-Arm_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Dumbbell_One-Arm_Triceps_Extension/1.jpg"
  ],
  "Dumbbell_One-Arm_Upright_Row": [
    "/assets/exercise-db/Dumbbell_One-Arm_Upright_Row/0.jpg",
    "/assets/exercise-db/Dumbbell_One-Arm_Upright_Row/1.jpg"
  ],
  "Dumbbell_Prone_Incline_Curl": [
    "/assets/exercise-db/Dumbbell_Prone_Incline_Curl/0.jpg",
    "/assets/exercise-db/Dumbbell_Prone_Incline_Curl/1.jpg"
  ],
  "Dumbbell_Raise": [
    "/assets/exercise-db/Dumbbell_Raise/0.jpg",
    "/assets/exercise-db/Dumbbell_Raise/1.jpg"
  ],
  "Dumbbell_Rear_Lunge": [
    "/assets/exercise-db/Dumbbell_Rear_Lunge/0.jpg",
    "/assets/exercise-db/Dumbbell_Rear_Lunge/1.jpg"
  ],
  "Dumbbell_Scaption": [
    "/assets/exercise-db/Dumbbell_Scaption/0.jpg",
    "/assets/exercise-db/Dumbbell_Scaption/1.jpg"
  ],
  "Dumbbell_Seated_Box_Jump": [
    "/assets/exercise-db/Dumbbell_Seated_Box_Jump/0.jpg",
    "/assets/exercise-db/Dumbbell_Seated_Box_Jump/1.jpg"
  ],
  "Dumbbell_Seated_One-Leg_Calf_Raise": [
    "/assets/exercise-db/Dumbbell_Seated_One-Leg_Calf_Raise/0.jpg",
    "/assets/exercise-db/Dumbbell_Seated_One-Leg_Calf_Raise/1.jpg"
  ],
  "Dumbbell_Shoulder_Press": [
    "/assets/exercise-db/Dumbbell_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Dumbbell_Shoulder_Press/1.jpg"
  ],
  "Dumbbell_Shrug": [
    "/assets/exercise-db/Dumbbell_Shrug/0.jpg",
    "/assets/exercise-db/Dumbbell_Shrug/1.jpg"
  ],
  "Dumbbell_Side_Bend": [
    "/assets/exercise-db/Dumbbell_Side_Bend/0.jpg",
    "/assets/exercise-db/Dumbbell_Side_Bend/1.jpg"
  ],
  "Dumbbell_Squat": [
    "/assets/exercise-db/Dumbbell_Squat/0.jpg",
    "/assets/exercise-db/Dumbbell_Squat/1.jpg"
  ],
  "Dumbbell_Squat_To_A_Bench": [
    "/assets/exercise-db/Dumbbell_Squat_To_A_Bench/0.jpg",
    "/assets/exercise-db/Dumbbell_Squat_To_A_Bench/1.jpg"
  ],
  "Dumbbell_Step_Ups": [
    "/assets/exercise-db/Dumbbell_Step_Ups/0.jpg",
    "/assets/exercise-db/Dumbbell_Step_Ups/1.jpg"
  ],
  "Dumbbell_Tricep_Extension_-Pronated_Grip": [
    "/assets/exercise-db/Dumbbell_Tricep_Extension_-Pronated_Grip/0.jpg",
    "/assets/exercise-db/Dumbbell_Tricep_Extension_-Pronated_Grip/1.jpg"
  ],
  "Dynamic_Back_Stretch": [
    "/assets/exercise-db/Dynamic_Back_Stretch/0.jpg",
    "/assets/exercise-db/Dynamic_Back_Stretch/1.jpg"
  ],
  "Dynamic_Chest_Stretch": [
    "/assets/exercise-db/Dynamic_Chest_Stretch/0.jpg",
    "/assets/exercise-db/Dynamic_Chest_Stretch/1.jpg"
  ],
  "EZ-Bar_Curl": [
    "/assets/exercise-db/EZ-Bar_Curl/0.jpg",
    "/assets/exercise-db/EZ-Bar_Curl/1.jpg"
  ],
  "EZ-Bar_Skullcrusher": [
    "/assets/exercise-db/EZ-Bar_Skullcrusher/0.jpg",
    "/assets/exercise-db/EZ-Bar_Skullcrusher/1.jpg"
  ],
  "Elbow_Circles": [
    "/assets/exercise-db/Elbow_Circles/0.jpg",
    "/assets/exercise-db/Elbow_Circles/1.jpg"
  ],
  "Elbow_to_Knee": [
    "/assets/exercise-db/Elbow_to_Knee/0.jpg",
    "/assets/exercise-db/Elbow_to_Knee/1.jpg"
  ],
  "Elbows_Back": [
    "/assets/exercise-db/Elbows_Back/0.jpg",
    "/assets/exercise-db/Elbows_Back/1.jpg"
  ],
  "Elevated_Back_Lunge": [
    "/assets/exercise-db/Elevated_Back_Lunge/0.jpg",
    "/assets/exercise-db/Elevated_Back_Lunge/1.jpg"
  ],
  "Elevated_Cable_Rows": [
    "/assets/exercise-db/Elevated_Cable_Rows/0.jpg",
    "/assets/exercise-db/Elevated_Cable_Rows/1.jpg"
  ],
  "Elliptical_Trainer": [
    "/assets/exercise-db/Elliptical_Trainer/0.jpg",
    "/assets/exercise-db/Elliptical_Trainer/1.jpg"
  ],
  "Exercise_Ball_Crunch": [
    "/assets/exercise-db/Exercise_Ball_Crunch/0.jpg",
    "/assets/exercise-db/Exercise_Ball_Crunch/1.jpg"
  ],
  "Exercise_Ball_Pull-In": [
    "/assets/exercise-db/Exercise_Ball_Pull-In/0.jpg",
    "/assets/exercise-db/Exercise_Ball_Pull-In/1.jpg"
  ],
  "Extended_Range_One-Arm_Kettlebell_Floor_Press": [
    "/assets/exercise-db/Extended_Range_One-Arm_Kettlebell_Floor_Press/0.jpg",
    "/assets/exercise-db/Extended_Range_One-Arm_Kettlebell_Floor_Press/1.jpg"
  ],
  "External_Rotation": [
    "/assets/exercise-db/External_Rotation/0.jpg",
    "/assets/exercise-db/External_Rotation/1.jpg"
  ],
  "External_Rotation_with_Band": [
    "/assets/exercise-db/External_Rotation_with_Band/0.jpg",
    "/assets/exercise-db/External_Rotation_with_Band/1.jpg"
  ],
  "External_Rotation_with_Cable": [
    "/assets/exercise-db/External_Rotation_with_Cable/0.jpg",
    "/assets/exercise-db/External_Rotation_with_Cable/1.jpg"
  ],
  "Face_Pull": [
    "/assets/exercise-db/Face_Pull/0.jpg",
    "/assets/exercise-db/Face_Pull/1.jpg"
  ],
  "Farmers_Walk": [
    "/assets/exercise-db/Farmers_Walk/0.jpg",
    "/assets/exercise-db/Farmers_Walk/1.jpg"
  ],
  "Fast_Skipping": [
    "/assets/exercise-db/Fast_Skipping/0.jpg",
    "/assets/exercise-db/Fast_Skipping/1.jpg"
  ],
  "Finger_Curls": [
    "/assets/exercise-db/Finger_Curls/0.jpg",
    "/assets/exercise-db/Finger_Curls/1.jpg"
  ],
  "Flat_Bench_Cable_Flyes": [
    "/assets/exercise-db/Flat_Bench_Cable_Flyes/0.jpg",
    "/assets/exercise-db/Flat_Bench_Cable_Flyes/1.jpg"
  ],
  "Flat_Bench_Leg_Pull-In": [
    "/assets/exercise-db/Flat_Bench_Leg_Pull-In/0.jpg",
    "/assets/exercise-db/Flat_Bench_Leg_Pull-In/1.jpg"
  ],
  "Flat_Bench_Lying_Leg_Raise": [
    "/assets/exercise-db/Flat_Bench_Lying_Leg_Raise/0.jpg",
    "/assets/exercise-db/Flat_Bench_Lying_Leg_Raise/1.jpg"
  ],
  "Flexor_Incline_Dumbbell_Curls": [
    "/assets/exercise-db/Flexor_Incline_Dumbbell_Curls/0.jpg",
    "/assets/exercise-db/Flexor_Incline_Dumbbell_Curls/1.jpg"
  ],
  "Floor_Glute-Ham_Raise": [
    "/assets/exercise-db/Floor_Glute-Ham_Raise/0.jpg",
    "/assets/exercise-db/Floor_Glute-Ham_Raise/1.jpg"
  ],
  "Floor_Press": [
    "/assets/exercise-db/Floor_Press/0.jpg",
    "/assets/exercise-db/Floor_Press/1.jpg"
  ],
  "Floor_Press_with_Chains": [
    "/assets/exercise-db/Floor_Press_with_Chains/0.jpg",
    "/assets/exercise-db/Floor_Press_with_Chains/1.jpg"
  ],
  "Flutter_Kicks": [
    "/assets/exercise-db/Flutter_Kicks/0.jpg",
    "/assets/exercise-db/Flutter_Kicks/1.jpg"
  ],
  "Foot-SMR": [
    "/assets/exercise-db/Foot-SMR/0.jpg",
    "/assets/exercise-db/Foot-SMR/1.jpg"
  ],
  "Forward_Drag_with_Press": [
    "/assets/exercise-db/Forward_Drag_with_Press/0.jpg",
    "/assets/exercise-db/Forward_Drag_with_Press/1.jpg"
  ],
  "Frankenstein_Squat": [
    "/assets/exercise-db/Frankenstein_Squat/0.jpg",
    "/assets/exercise-db/Frankenstein_Squat/1.jpg"
  ],
  "Freehand_Jump_Squat": [
    "/assets/exercise-db/Freehand_Jump_Squat/0.jpg",
    "/assets/exercise-db/Freehand_Jump_Squat/1.jpg"
  ],
  "Frog_Hops": [
    "/assets/exercise-db/Frog_Hops/0.jpg",
    "/assets/exercise-db/Frog_Hops/1.jpg"
  ],
  "Frog_Sit-Ups": [
    "/assets/exercise-db/Frog_Sit-Ups/0.jpg",
    "/assets/exercise-db/Frog_Sit-Ups/1.jpg"
  ],
  "Front_Barbell_Squat": [
    "/assets/exercise-db/Front_Barbell_Squat/0.jpg",
    "/assets/exercise-db/Front_Barbell_Squat/1.jpg"
  ],
  "Front_Barbell_Squat_To_A_Bench": [
    "/assets/exercise-db/Front_Barbell_Squat_To_A_Bench/0.jpg",
    "/assets/exercise-db/Front_Barbell_Squat_To_A_Bench/1.jpg"
  ],
  "Front_Box_Jump": [
    "/assets/exercise-db/Front_Box_Jump/0.jpg",
    "/assets/exercise-db/Front_Box_Jump/1.jpg"
  ],
  "Front_Cable_Raise": [
    "/assets/exercise-db/Front_Cable_Raise/0.jpg",
    "/assets/exercise-db/Front_Cable_Raise/1.jpg"
  ],
  "Front_Cone_Hops_or_hurdle_hops": [
    "/assets/exercise-db/Front_Cone_Hops_or_hurdle_hops/0.jpg",
    "/assets/exercise-db/Front_Cone_Hops_or_hurdle_hops/1.jpg"
  ],
  "Front_Dumbbell_Raise": [
    "/assets/exercise-db/Front_Dumbbell_Raise/0.jpg",
    "/assets/exercise-db/Front_Dumbbell_Raise/1.jpg"
  ],
  "Front_Incline_Dumbbell_Raise": [
    "/assets/exercise-db/Front_Incline_Dumbbell_Raise/0.jpg",
    "/assets/exercise-db/Front_Incline_Dumbbell_Raise/1.jpg"
  ],
  "Front_Leg_Raises": [
    "/assets/exercise-db/Front_Leg_Raises/0.jpg",
    "/assets/exercise-db/Front_Leg_Raises/1.jpg"
  ],
  "Front_Plate_Raise": [
    "/assets/exercise-db/Front_Plate_Raise/0.jpg",
    "/assets/exercise-db/Front_Plate_Raise/1.jpg"
  ],
  "Front_Raise_And_Pullover": [
    "/assets/exercise-db/Front_Raise_And_Pullover/0.jpg",
    "/assets/exercise-db/Front_Raise_And_Pullover/1.jpg"
  ],
  "Front_Squat_Clean_Grip": [
    "/assets/exercise-db/Front_Squat_Clean_Grip/0.jpg",
    "/assets/exercise-db/Front_Squat_Clean_Grip/1.jpg"
  ],
  "Front_Squats_With_Two_Kettlebells": [
    "/assets/exercise-db/Front_Squats_With_Two_Kettlebells/0.jpg",
    "/assets/exercise-db/Front_Squats_With_Two_Kettlebells/1.jpg"
  ],
  "Front_Two-Dumbbell_Raise": [
    "/assets/exercise-db/Front_Two-Dumbbell_Raise/0.jpg",
    "/assets/exercise-db/Front_Two-Dumbbell_Raise/1.jpg"
  ],
  "Full_Range-Of-Motion_Lat_Pulldown": [
    "/assets/exercise-db/Full_Range-Of-Motion_Lat_Pulldown/0.jpg",
    "/assets/exercise-db/Full_Range-Of-Motion_Lat_Pulldown/1.jpg"
  ],
  "Gironda_Sternum_Chins": [
    "/assets/exercise-db/Gironda_Sternum_Chins/0.jpg",
    "/assets/exercise-db/Gironda_Sternum_Chins/1.jpg"
  ],
  "Glute_Ham_Raise": [
    "/assets/exercise-db/Glute_Ham_Raise/0.jpg",
    "/assets/exercise-db/Glute_Ham_Raise/1.jpg"
  ],
  "Glute_Kickback": [
    "/assets/exercise-db/Glute_Kickback/0.jpg",
    "/assets/exercise-db/Glute_Kickback/1.jpg"
  ],
  "Goblet_Squat": [
    "/assets/exercise-db/Goblet_Squat/0.jpg",
    "/assets/exercise-db/Goblet_Squat/1.jpg"
  ],
  "Good_Morning": [
    "/assets/exercise-db/Good_Morning/0.jpg",
    "/assets/exercise-db/Good_Morning/1.jpg"
  ],
  "Good_Morning_off_Pins": [
    "/assets/exercise-db/Good_Morning_off_Pins/0.jpg",
    "/assets/exercise-db/Good_Morning_off_Pins/1.jpg"
  ],
  "Gorilla_Chin_Crunch": [
    "/assets/exercise-db/Gorilla_Chin_Crunch/0.jpg",
    "/assets/exercise-db/Gorilla_Chin_Crunch/1.jpg"
  ],
  "Groin_and_Back_Stretch": [
    "/assets/exercise-db/Groin_and_Back_Stretch/0.jpg",
    "/assets/exercise-db/Groin_and_Back_Stretch/1.jpg"
  ],
  "Groiners": [
    "/assets/exercise-db/Groiners/0.jpg",
    "/assets/exercise-db/Groiners/1.jpg"
  ],
  "Hack_Squat": [
    "/assets/exercise-db/Hack_Squat/0.jpg",
    "/assets/exercise-db/Hack_Squat/1.jpg"
  ],
  "Hammer_Curls": [
    "/assets/exercise-db/Hammer_Curls/0.jpg",
    "/assets/exercise-db/Hammer_Curls/1.jpg"
  ],
  "Hammer_Grip_Incline_DB_Bench_Press": [
    "/assets/exercise-db/Hammer_Grip_Incline_DB_Bench_Press/0.jpg",
    "/assets/exercise-db/Hammer_Grip_Incline_DB_Bench_Press/1.jpg"
  ],
  "Hamstring-SMR": [
    "/assets/exercise-db/Hamstring-SMR/0.jpg",
    "/assets/exercise-db/Hamstring-SMR/1.jpg"
  ],
  "Hamstring_Stretch": [
    "/assets/exercise-db/Hamstring_Stretch/0.jpg",
    "/assets/exercise-db/Hamstring_Stretch/1.jpg"
  ],
  "Handstand_Push-Ups": [
    "/assets/exercise-db/Handstand_Push-Ups/0.jpg",
    "/assets/exercise-db/Handstand_Push-Ups/1.jpg"
  ],
  "Hang_Clean": [
    "/assets/exercise-db/Hang_Clean/0.jpg",
    "/assets/exercise-db/Hang_Clean/1.jpg"
  ],
  "Hang_Clean_-_Below_the_Knees": [
    "/assets/exercise-db/Hang_Clean_-_Below_the_Knees/0.jpg",
    "/assets/exercise-db/Hang_Clean_-_Below_the_Knees/1.jpg"
  ],
  "Hang_Snatch": [
    "/assets/exercise-db/Hang_Snatch/0.jpg",
    "/assets/exercise-db/Hang_Snatch/1.jpg"
  ],
  "Hang_Snatch_-_Below_Knees": [
    "/assets/exercise-db/Hang_Snatch_-_Below_Knees/0.jpg",
    "/assets/exercise-db/Hang_Snatch_-_Below_Knees/1.jpg"
  ],
  "Hanging_Bar_Good_Morning": [
    "/assets/exercise-db/Hanging_Bar_Good_Morning/0.jpg",
    "/assets/exercise-db/Hanging_Bar_Good_Morning/1.jpg"
  ],
  "Hanging_Leg_Raise": [
    "/assets/exercise-db/Hanging_Leg_Raise/0.jpg",
    "/assets/exercise-db/Hanging_Leg_Raise/1.jpg"
  ],
  "Hanging_Pike": [
    "/assets/exercise-db/Hanging_Pike/0.jpg",
    "/assets/exercise-db/Hanging_Pike/1.jpg"
  ],
  "Heaving_Snatch_Balance": [
    "/assets/exercise-db/Heaving_Snatch_Balance/0.jpg",
    "/assets/exercise-db/Heaving_Snatch_Balance/1.jpg"
  ],
  "Heavy_Bag_Thrust": [
    "/assets/exercise-db/Heavy_Bag_Thrust/0.jpg",
    "/assets/exercise-db/Heavy_Bag_Thrust/1.jpg"
  ],
  "High_Cable_Curls": [
    "/assets/exercise-db/High_Cable_Curls/0.jpg",
    "/assets/exercise-db/High_Cable_Curls/1.jpg"
  ],
  "Hip_Circles_prone": [
    "/assets/exercise-db/Hip_Circles_prone/0.jpg",
    "/assets/exercise-db/Hip_Circles_prone/1.jpg"
  ],
  "Hip_Extension_with_Bands": [
    "/assets/exercise-db/Hip_Extension_with_Bands/0.jpg",
    "/assets/exercise-db/Hip_Extension_with_Bands/1.jpg"
  ],
  "Hip_Flexion_with_Band": [
    "/assets/exercise-db/Hip_Flexion_with_Band/0.jpg",
    "/assets/exercise-db/Hip_Flexion_with_Band/1.jpg"
  ],
  "Hip_Lift_with_Band": [
    "/assets/exercise-db/Hip_Lift_with_Band/0.jpg",
    "/assets/exercise-db/Hip_Lift_with_Band/1.jpg"
  ],
  "Hug_A_Ball": [
    "/assets/exercise-db/Hug_A_Ball/0.jpg",
    "/assets/exercise-db/Hug_A_Ball/1.jpg"
  ],
  "Hug_Knees_To_Chest": [
    "/assets/exercise-db/Hug_Knees_To_Chest/0.jpg",
    "/assets/exercise-db/Hug_Knees_To_Chest/1.jpg"
  ],
  "Hurdle_Hops": [
    "/assets/exercise-db/Hurdle_Hops/0.jpg",
    "/assets/exercise-db/Hurdle_Hops/1.jpg"
  ],
  "Hyperextensions_Back_Extensions": [
    "/assets/exercise-db/Hyperextensions_Back_Extensions/0.jpg",
    "/assets/exercise-db/Hyperextensions_Back_Extensions/1.jpg"
  ],
  "Hyperextensions_With_No_Hyperextension_Bench": [
    "/assets/exercise-db/Hyperextensions_With_No_Hyperextension_Bench/0.jpg",
    "/assets/exercise-db/Hyperextensions_With_No_Hyperextension_Bench/1.jpg"
  ],
  "IT_Band_and_Glute_Stretch": [
    "/assets/exercise-db/IT_Band_and_Glute_Stretch/0.jpg",
    "/assets/exercise-db/IT_Band_and_Glute_Stretch/1.jpg"
  ],
  "Iliotibial_Tract-SMR": [
    "/assets/exercise-db/Iliotibial_Tract-SMR/0.jpg",
    "/assets/exercise-db/Iliotibial_Tract-SMR/1.jpg"
  ],
  "Inchworm": [
    "/assets/exercise-db/Inchworm/0.jpg",
    "/assets/exercise-db/Inchworm/1.jpg"
  ],
  "Incline_Barbell_Triceps_Extension": [
    "/assets/exercise-db/Incline_Barbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Incline_Barbell_Triceps_Extension/1.jpg"
  ],
  "Incline_Bench_Pull": [
    "/assets/exercise-db/Incline_Bench_Pull/0.jpg",
    "/assets/exercise-db/Incline_Bench_Pull/1.jpg"
  ],
  "Incline_Cable_Chest_Press": [
    "/assets/exercise-db/Incline_Cable_Chest_Press/0.jpg",
    "/assets/exercise-db/Incline_Cable_Chest_Press/1.jpg"
  ],
  "Incline_Cable_Flye": [
    "/assets/exercise-db/Incline_Cable_Flye/0.jpg",
    "/assets/exercise-db/Incline_Cable_Flye/1.jpg"
  ],
  "Incline_Dumbbell_Bench_With_Palms_Facing_In": [
    "/assets/exercise-db/Incline_Dumbbell_Bench_With_Palms_Facing_In/0.jpg",
    "/assets/exercise-db/Incline_Dumbbell_Bench_With_Palms_Facing_In/1.jpg"
  ],
  "Incline_Dumbbell_Curl": [
    "/assets/exercise-db/Incline_Dumbbell_Curl/0.jpg",
    "/assets/exercise-db/Incline_Dumbbell_Curl/1.jpg"
  ],
  "Incline_Dumbbell_Flyes": [
    "/assets/exercise-db/Incline_Dumbbell_Flyes/0.jpg",
    "/assets/exercise-db/Incline_Dumbbell_Flyes/1.jpg"
  ],
  "Incline_Dumbbell_Flyes_-_With_A_Twist": [
    "/assets/exercise-db/Incline_Dumbbell_Flyes_-_With_A_Twist/0.jpg",
    "/assets/exercise-db/Incline_Dumbbell_Flyes_-_With_A_Twist/1.jpg"
  ],
  "Incline_Dumbbell_Press": [
    "/assets/exercise-db/Incline_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Incline_Dumbbell_Press/1.jpg"
  ],
  "Incline_Hammer_Curls": [
    "/assets/exercise-db/Incline_Hammer_Curls/0.jpg",
    "/assets/exercise-db/Incline_Hammer_Curls/1.jpg"
  ],
  "Incline_Inner_Biceps_Curl": [
    "/assets/exercise-db/Incline_Inner_Biceps_Curl/0.jpg",
    "/assets/exercise-db/Incline_Inner_Biceps_Curl/1.jpg"
  ],
  "Incline_Push-Up": [
    "/assets/exercise-db/Incline_Push-Up/0.jpg",
    "/assets/exercise-db/Incline_Push-Up/1.jpg"
  ],
  "Incline_Push-Up_Close-Grip": [
    "/assets/exercise-db/Incline_Push-Up_Close-Grip/0.jpg",
    "/assets/exercise-db/Incline_Push-Up_Close-Grip/1.jpg"
  ],
  "Incline_Push-Up_Depth_Jump": [
    "/assets/exercise-db/Incline_Push-Up_Depth_Jump/0.jpg",
    "/assets/exercise-db/Incline_Push-Up_Depth_Jump/1.jpg"
  ],
  "Incline_Push-Up_Medium": [
    "/assets/exercise-db/Incline_Push-Up_Medium/0.jpg",
    "/assets/exercise-db/Incline_Push-Up_Medium/1.jpg"
  ],
  "Incline_Push-Up_Reverse_Grip": [
    "/assets/exercise-db/Incline_Push-Up_Reverse_Grip/0.jpg",
    "/assets/exercise-db/Incline_Push-Up_Reverse_Grip/1.jpg"
  ],
  "Incline_Push-Up_Wide": [
    "/assets/exercise-db/Incline_Push-Up_Wide/0.jpg",
    "/assets/exercise-db/Incline_Push-Up_Wide/1.jpg"
  ],
  "Intermediate_Groin_Stretch": [
    "/assets/exercise-db/Intermediate_Groin_Stretch/0.jpg",
    "/assets/exercise-db/Intermediate_Groin_Stretch/1.jpg"
  ],
  "Intermediate_Hip_Flexor_and_Quad_Stretch": [
    "/assets/exercise-db/Intermediate_Hip_Flexor_and_Quad_Stretch/0.jpg",
    "/assets/exercise-db/Intermediate_Hip_Flexor_and_Quad_Stretch/1.jpg"
  ],
  "Internal_Rotation_with_Band": [
    "/assets/exercise-db/Internal_Rotation_with_Band/0.jpg",
    "/assets/exercise-db/Internal_Rotation_with_Band/1.jpg"
  ],
  "Inverted_Row": [
    "/assets/exercise-db/Inverted_Row/0.jpg",
    "/assets/exercise-db/Inverted_Row/1.jpg"
  ],
  "Inverted_Row_with_Straps": [
    "/assets/exercise-db/Inverted_Row_with_Straps/0.jpg",
    "/assets/exercise-db/Inverted_Row_with_Straps/1.jpg"
  ],
  "Iron_Cross": [
    "/assets/exercise-db/Iron_Cross/0.jpg",
    "/assets/exercise-db/Iron_Cross/1.jpg"
  ],
  "Iron_Crosses_stretch": [
    "/assets/exercise-db/Iron_Crosses_stretch/0.jpg",
    "/assets/exercise-db/Iron_Crosses_stretch/1.jpg"
  ],
  "Isometric_Chest_Squeezes": [
    "/assets/exercise-db/Isometric_Chest_Squeezes/0.jpg",
    "/assets/exercise-db/Isometric_Chest_Squeezes/1.jpg"
  ],
  "Isometric_Neck_Exercise_-_Front_And_Back": [
    "/assets/exercise-db/Isometric_Neck_Exercise_-_Front_And_Back/0.jpg",
    "/assets/exercise-db/Isometric_Neck_Exercise_-_Front_And_Back/1.jpg"
  ],
  "Isometric_Neck_Exercise_-_Sides": [
    "/assets/exercise-db/Isometric_Neck_Exercise_-_Sides/0.jpg",
    "/assets/exercise-db/Isometric_Neck_Exercise_-_Sides/1.jpg"
  ],
  "Isometric_Wipers": [
    "/assets/exercise-db/Isometric_Wipers/0.jpg",
    "/assets/exercise-db/Isometric_Wipers/1.jpg"
  ],
  "JM_Press": [
    "/assets/exercise-db/JM_Press/0.jpg",
    "/assets/exercise-db/JM_Press/1.jpg"
  ],
  "Jackknife_Sit-Up": [
    "/assets/exercise-db/Jackknife_Sit-Up/0.jpg",
    "/assets/exercise-db/Jackknife_Sit-Up/1.jpg"
  ],
  "Janda_Sit-Up": [
    "/assets/exercise-db/Janda_Sit-Up/0.jpg",
    "/assets/exercise-db/Janda_Sit-Up/1.jpg"
  ],
  "Jefferson_Squats": [
    "/assets/exercise-db/Jefferson_Squats/0.jpg",
    "/assets/exercise-db/Jefferson_Squats/1.jpg"
  ],
  "Jerk_Balance": [
    "/assets/exercise-db/Jerk_Balance/0.jpg",
    "/assets/exercise-db/Jerk_Balance/1.jpg"
  ],
  "Jerk_Dip_Squat": [
    "/assets/exercise-db/Jerk_Dip_Squat/0.jpg",
    "/assets/exercise-db/Jerk_Dip_Squat/1.jpg"
  ],
  "Jogging_Treadmill": [
    "/assets/exercise-db/Jogging_Treadmill/0.jpg",
    "/assets/exercise-db/Jogging_Treadmill/1.jpg"
  ],
  "Keg_Load": [
    "/assets/exercise-db/Keg_Load/0.jpg",
    "/assets/exercise-db/Keg_Load/1.jpg"
  ],
  "Kettlebell_Arnold_Press": [
    "/assets/exercise-db/Kettlebell_Arnold_Press/0.jpg",
    "/assets/exercise-db/Kettlebell_Arnold_Press/1.jpg"
  ],
  "Kettlebell_Dead_Clean": [
    "/assets/exercise-db/Kettlebell_Dead_Clean/0.jpg",
    "/assets/exercise-db/Kettlebell_Dead_Clean/1.jpg"
  ],
  "Kettlebell_Figure_8": [
    "/assets/exercise-db/Kettlebell_Figure_8/0.jpg",
    "/assets/exercise-db/Kettlebell_Figure_8/1.jpg"
  ],
  "Kettlebell_Hang_Clean": [
    "/assets/exercise-db/Kettlebell_Hang_Clean/0.jpg",
    "/assets/exercise-db/Kettlebell_Hang_Clean/1.jpg"
  ],
  "Kettlebell_One-Legged_Deadlift": [
    "/assets/exercise-db/Kettlebell_One-Legged_Deadlift/0.jpg",
    "/assets/exercise-db/Kettlebell_One-Legged_Deadlift/1.jpg"
  ],
  "Kettlebell_Pass_Between_The_Legs": [
    "/assets/exercise-db/Kettlebell_Pass_Between_The_Legs/0.jpg",
    "/assets/exercise-db/Kettlebell_Pass_Between_The_Legs/1.jpg"
  ],
  "Kettlebell_Pirate_Ships": [
    "/assets/exercise-db/Kettlebell_Pirate_Ships/0.jpg",
    "/assets/exercise-db/Kettlebell_Pirate_Ships/1.jpg"
  ],
  "Kettlebell_Pistol_Squat": [
    "/assets/exercise-db/Kettlebell_Pistol_Squat/0.jpg",
    "/assets/exercise-db/Kettlebell_Pistol_Squat/1.jpg"
  ],
  "Kettlebell_Seated_Press": [
    "/assets/exercise-db/Kettlebell_Seated_Press/0.jpg",
    "/assets/exercise-db/Kettlebell_Seated_Press/1.jpg"
  ],
  "Kettlebell_Seesaw_Press": [
    "/assets/exercise-db/Kettlebell_Seesaw_Press/0.jpg",
    "/assets/exercise-db/Kettlebell_Seesaw_Press/1.jpg"
  ],
  "Kettlebell_Sumo_High_Pull": [
    "/assets/exercise-db/Kettlebell_Sumo_High_Pull/0.jpg",
    "/assets/exercise-db/Kettlebell_Sumo_High_Pull/1.jpg"
  ],
  "Kettlebell_Thruster": [
    "/assets/exercise-db/Kettlebell_Thruster/0.jpg",
    "/assets/exercise-db/Kettlebell_Thruster/1.jpg"
  ],
  "Kettlebell_Turkish_Get-Up_Lunge_style": [
    "/assets/exercise-db/Kettlebell_Turkish_Get-Up_Lunge_style/0.jpg",
    "/assets/exercise-db/Kettlebell_Turkish_Get-Up_Lunge_style/1.jpg"
  ],
  "Kettlebell_Turkish_Get-Up_Squat_style": [
    "/assets/exercise-db/Kettlebell_Turkish_Get-Up_Squat_style/0.jpg",
    "/assets/exercise-db/Kettlebell_Turkish_Get-Up_Squat_style/1.jpg"
  ],
  "Kettlebell_Windmill": [
    "/assets/exercise-db/Kettlebell_Windmill/0.jpg",
    "/assets/exercise-db/Kettlebell_Windmill/1.jpg"
  ],
  "Kipping_Muscle_Up": [
    "/assets/exercise-db/Kipping_Muscle_Up/0.jpg",
    "/assets/exercise-db/Kipping_Muscle_Up/1.jpg"
  ],
  "Knee_Across_The_Body": [
    "/assets/exercise-db/Knee_Across_The_Body/0.jpg",
    "/assets/exercise-db/Knee_Across_The_Body/1.jpg"
  ],
  "Knee_Circles": [
    "/assets/exercise-db/Knee_Circles/0.jpg",
    "/assets/exercise-db/Knee_Circles/1.jpg"
  ],
  "Knee_Hip_Raise_On_Parallel_Bars": [
    "/assets/exercise-db/Knee_Hip_Raise_On_Parallel_Bars/0.jpg",
    "/assets/exercise-db/Knee_Hip_Raise_On_Parallel_Bars/1.jpg"
  ],
  "Knee_Tuck_Jump": [
    "/assets/exercise-db/Knee_Tuck_Jump/0.jpg",
    "/assets/exercise-db/Knee_Tuck_Jump/1.jpg"
  ],
  "Kneeling_Arm_Drill": [
    "/assets/exercise-db/Kneeling_Arm_Drill/0.jpg",
    "/assets/exercise-db/Kneeling_Arm_Drill/1.jpg"
  ],
  "Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists": [
    "/assets/exercise-db/Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists/0.jpg",
    "/assets/exercise-db/Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists/1.jpg"
  ],
  "Kneeling_Cable_Triceps_Extension": [
    "/assets/exercise-db/Kneeling_Cable_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Kneeling_Cable_Triceps_Extension/1.jpg"
  ],
  "Kneeling_Forearm_Stretch": [
    "/assets/exercise-db/Kneeling_Forearm_Stretch/0.jpg",
    "/assets/exercise-db/Kneeling_Forearm_Stretch/1.jpg"
  ],
  "Kneeling_High_Pulley_Row": [
    "/assets/exercise-db/Kneeling_High_Pulley_Row/0.jpg",
    "/assets/exercise-db/Kneeling_High_Pulley_Row/1.jpg"
  ],
  "Kneeling_Hip_Flexor": [
    "/assets/exercise-db/Kneeling_Hip_Flexor/0.jpg",
    "/assets/exercise-db/Kneeling_Hip_Flexor/1.jpg"
  ],
  "Kneeling_Jump_Squat": [
    "/assets/exercise-db/Kneeling_Jump_Squat/0.jpg",
    "/assets/exercise-db/Kneeling_Jump_Squat/1.jpg"
  ],
  "Kneeling_Single-Arm_High_Pulley_Row": [
    "/assets/exercise-db/Kneeling_Single-Arm_High_Pulley_Row/0.jpg",
    "/assets/exercise-db/Kneeling_Single-Arm_High_Pulley_Row/1.jpg"
  ],
  "Kneeling_Squat": [
    "/assets/exercise-db/Kneeling_Squat/0.jpg",
    "/assets/exercise-db/Kneeling_Squat/1.jpg"
  ],
  "Landmine_180s": [
    "/assets/exercise-db/Landmine_180s/0.jpg",
    "/assets/exercise-db/Landmine_180s/1.jpg"
  ],
  "Landmine_Linear_Jammer": [
    "/assets/exercise-db/Landmine_Linear_Jammer/0.jpg",
    "/assets/exercise-db/Landmine_Linear_Jammer/1.jpg"
  ],
  "Lateral_Bound": [
    "/assets/exercise-db/Lateral_Bound/0.jpg",
    "/assets/exercise-db/Lateral_Bound/1.jpg"
  ],
  "Lateral_Box_Jump": [
    "/assets/exercise-db/Lateral_Box_Jump/0.jpg",
    "/assets/exercise-db/Lateral_Box_Jump/1.jpg"
  ],
  "Lateral_Cone_Hops": [
    "/assets/exercise-db/Lateral_Cone_Hops/0.jpg",
    "/assets/exercise-db/Lateral_Cone_Hops/1.jpg"
  ],
  "Lateral_Raise_-_With_Bands": [
    "/assets/exercise-db/Lateral_Raise_-_With_Bands/0.jpg",
    "/assets/exercise-db/Lateral_Raise_-_With_Bands/1.jpg"
  ],
  "Latissimus_Dorsi-SMR": [
    "/assets/exercise-db/Latissimus_Dorsi-SMR/0.jpg",
    "/assets/exercise-db/Latissimus_Dorsi-SMR/1.jpg"
  ],
  "Leg-Over_Floor_Press": [
    "/assets/exercise-db/Leg-Over_Floor_Press/0.jpg",
    "/assets/exercise-db/Leg-Over_Floor_Press/1.jpg"
  ],
  "Leg-Up_Hamstring_Stretch": [
    "/assets/exercise-db/Leg-Up_Hamstring_Stretch/0.jpg",
    "/assets/exercise-db/Leg-Up_Hamstring_Stretch/1.jpg"
  ],
  "Leg_Extensions": [
    "/assets/exercise-db/Leg_Extensions/0.jpg",
    "/assets/exercise-db/Leg_Extensions/1.jpg"
  ],
  "Leg_Lift": [
    "/assets/exercise-db/Leg_Lift/0.jpg",
    "/assets/exercise-db/Leg_Lift/1.jpg"
  ],
  "Leg_Press": [
    "/assets/exercise-db/Leg_Press/0.jpg",
    "/assets/exercise-db/Leg_Press/1.jpg"
  ],
  "Leg_Pull-In": [
    "/assets/exercise-db/Leg_Pull-In/0.jpg",
    "/assets/exercise-db/Leg_Pull-In/1.jpg"
  ],
  "Leverage_Chest_Press": [
    "/assets/exercise-db/Leverage_Chest_Press/0.jpg",
    "/assets/exercise-db/Leverage_Chest_Press/1.jpg"
  ],
  "Leverage_Deadlift": [
    "/assets/exercise-db/Leverage_Deadlift/0.jpg",
    "/assets/exercise-db/Leverage_Deadlift/1.jpg"
  ],
  "Leverage_Decline_Chest_Press": [
    "/assets/exercise-db/Leverage_Decline_Chest_Press/0.jpg",
    "/assets/exercise-db/Leverage_Decline_Chest_Press/1.jpg"
  ],
  "Leverage_High_Row": [
    "/assets/exercise-db/Leverage_High_Row/0.jpg",
    "/assets/exercise-db/Leverage_High_Row/1.jpg"
  ],
  "Leverage_Incline_Chest_Press": [
    "/assets/exercise-db/Leverage_Incline_Chest_Press/0.jpg",
    "/assets/exercise-db/Leverage_Incline_Chest_Press/1.jpg"
  ],
  "Leverage_Iso_Row": [
    "/assets/exercise-db/Leverage_Iso_Row/0.jpg",
    "/assets/exercise-db/Leverage_Iso_Row/1.jpg"
  ],
  "Leverage_Shoulder_Press": [
    "/assets/exercise-db/Leverage_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Leverage_Shoulder_Press/1.jpg"
  ],
  "Leverage_Shrug": [
    "/assets/exercise-db/Leverage_Shrug/0.jpg",
    "/assets/exercise-db/Leverage_Shrug/1.jpg"
  ],
  "Linear_3-Part_Start_Technique": [
    "/assets/exercise-db/Linear_3-Part_Start_Technique/0.jpg",
    "/assets/exercise-db/Linear_3-Part_Start_Technique/1.jpg"
  ],
  "Linear_Acceleration_Wall_Drill": [
    "/assets/exercise-db/Linear_Acceleration_Wall_Drill/0.jpg",
    "/assets/exercise-db/Linear_Acceleration_Wall_Drill/1.jpg"
  ],
  "Linear_Depth_Jump": [
    "/assets/exercise-db/Linear_Depth_Jump/0.jpg",
    "/assets/exercise-db/Linear_Depth_Jump/1.jpg"
  ],
  "Log_Lift": [
    "/assets/exercise-db/Log_Lift/0.jpg",
    "/assets/exercise-db/Log_Lift/1.jpg"
  ],
  "London_Bridges": [
    "/assets/exercise-db/London_Bridges/0.jpg",
    "/assets/exercise-db/London_Bridges/1.jpg"
  ],
  "Looking_At_Ceiling": [
    "/assets/exercise-db/Looking_At_Ceiling/0.jpg",
    "/assets/exercise-db/Looking_At_Ceiling/1.jpg"
  ],
  "Low_Cable_Crossover": [
    "/assets/exercise-db/Low_Cable_Crossover/0.jpg",
    "/assets/exercise-db/Low_Cable_Crossover/1.jpg"
  ],
  "Low_Cable_Triceps_Extension": [
    "/assets/exercise-db/Low_Cable_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Low_Cable_Triceps_Extension/1.jpg"
  ],
  "Low_Pulley_Row_To_Neck": [
    "/assets/exercise-db/Low_Pulley_Row_To_Neck/0.jpg",
    "/assets/exercise-db/Low_Pulley_Row_To_Neck/1.jpg"
  ],
  "Lower_Back-SMR": [
    "/assets/exercise-db/Lower_Back-SMR/0.jpg",
    "/assets/exercise-db/Lower_Back-SMR/1.jpg"
  ],
  "Lower_Back_Curl": [
    "/assets/exercise-db/Lower_Back_Curl/0.jpg",
    "/assets/exercise-db/Lower_Back_Curl/1.jpg"
  ],
  "Lunge_Pass_Through": [
    "/assets/exercise-db/Lunge_Pass_Through/0.jpg",
    "/assets/exercise-db/Lunge_Pass_Through/1.jpg"
  ],
  "Lunge_Sprint": [
    "/assets/exercise-db/Lunge_Sprint/0.jpg",
    "/assets/exercise-db/Lunge_Sprint/1.jpg"
  ],
  "Lying_Bent_Leg_Groin": [
    "/assets/exercise-db/Lying_Bent_Leg_Groin/0.jpg",
    "/assets/exercise-db/Lying_Bent_Leg_Groin/1.jpg"
  ],
  "Lying_Cable_Curl": [
    "/assets/exercise-db/Lying_Cable_Curl/0.jpg",
    "/assets/exercise-db/Lying_Cable_Curl/1.jpg"
  ],
  "Lying_Cambered_Barbell_Row": [
    "/assets/exercise-db/Lying_Cambered_Barbell_Row/0.jpg",
    "/assets/exercise-db/Lying_Cambered_Barbell_Row/1.jpg"
  ],
  "Lying_Close-Grip_Bar_Curl_On_High_Pulley": [
    "/assets/exercise-db/Lying_Close-Grip_Bar_Curl_On_High_Pulley/0.jpg",
    "/assets/exercise-db/Lying_Close-Grip_Bar_Curl_On_High_Pulley/1.jpg"
  ],
  "Lying_Close-Grip_Barbell_Triceps_Extension_Behind_The_Head": [
    "/assets/exercise-db/Lying_Close-Grip_Barbell_Triceps_Extension_Behind_The_Head/0.jpg",
    "/assets/exercise-db/Lying_Close-Grip_Barbell_Triceps_Extension_Behind_The_Head/1.jpg"
  ],
  "Lying_Close-Grip_Barbell_Triceps_Press_To_Chin": [
    "/assets/exercise-db/Lying_Close-Grip_Barbell_Triceps_Press_To_Chin/0.jpg",
    "/assets/exercise-db/Lying_Close-Grip_Barbell_Triceps_Press_To_Chin/1.jpg"
  ],
  "Lying_Crossover": [
    "/assets/exercise-db/Lying_Crossover/0.jpg",
    "/assets/exercise-db/Lying_Crossover/1.jpg"
  ],
  "Lying_Dumbbell_Tricep_Extension": [
    "/assets/exercise-db/Lying_Dumbbell_Tricep_Extension/0.jpg",
    "/assets/exercise-db/Lying_Dumbbell_Tricep_Extension/1.jpg"
  ],
  "Lying_Face_Down_Plate_Neck_Resistance": [
    "/assets/exercise-db/Lying_Face_Down_Plate_Neck_Resistance/0.jpg",
    "/assets/exercise-db/Lying_Face_Down_Plate_Neck_Resistance/1.jpg"
  ],
  "Lying_Face_Up_Plate_Neck_Resistance": [
    "/assets/exercise-db/Lying_Face_Up_Plate_Neck_Resistance/0.jpg",
    "/assets/exercise-db/Lying_Face_Up_Plate_Neck_Resistance/1.jpg"
  ],
  "Lying_Glute": [
    "/assets/exercise-db/Lying_Glute/0.jpg",
    "/assets/exercise-db/Lying_Glute/1.jpg"
  ],
  "Lying_Hamstring": [
    "/assets/exercise-db/Lying_Hamstring/0.jpg",
    "/assets/exercise-db/Lying_Hamstring/1.jpg"
  ],
  "Lying_High_Bench_Barbell_Curl": [
    "/assets/exercise-db/Lying_High_Bench_Barbell_Curl/0.jpg",
    "/assets/exercise-db/Lying_High_Bench_Barbell_Curl/1.jpg"
  ],
  "Lying_Leg_Curls": [
    "/assets/exercise-db/Lying_Leg_Curls/0.jpg",
    "/assets/exercise-db/Lying_Leg_Curls/1.jpg"
  ],
  "Lying_Machine_Squat": [
    "/assets/exercise-db/Lying_Machine_Squat/0.jpg",
    "/assets/exercise-db/Lying_Machine_Squat/1.jpg"
  ],
  "Lying_One-Arm_Lateral_Raise": [
    "/assets/exercise-db/Lying_One-Arm_Lateral_Raise/0.jpg",
    "/assets/exercise-db/Lying_One-Arm_Lateral_Raise/1.jpg"
  ],
  "Lying_Prone_Quadriceps": [
    "/assets/exercise-db/Lying_Prone_Quadriceps/0.jpg",
    "/assets/exercise-db/Lying_Prone_Quadriceps/1.jpg"
  ],
  "Lying_Rear_Delt_Raise": [
    "/assets/exercise-db/Lying_Rear_Delt_Raise/0.jpg",
    "/assets/exercise-db/Lying_Rear_Delt_Raise/1.jpg"
  ],
  "Lying_Supine_Dumbbell_Curl": [
    "/assets/exercise-db/Lying_Supine_Dumbbell_Curl/0.jpg",
    "/assets/exercise-db/Lying_Supine_Dumbbell_Curl/1.jpg"
  ],
  "Lying_T-Bar_Row": [
    "/assets/exercise-db/Lying_T-Bar_Row/0.jpg",
    "/assets/exercise-db/Lying_T-Bar_Row/1.jpg"
  ],
  "Lying_Triceps_Press": [
    "/assets/exercise-db/Lying_Triceps_Press/0.jpg",
    "/assets/exercise-db/Lying_Triceps_Press/1.jpg"
  ],
  "Machine_Bench_Press": [
    "/assets/exercise-db/Machine_Bench_Press/0.jpg",
    "/assets/exercise-db/Machine_Bench_Press/1.jpg"
  ],
  "Machine_Bicep_Curl": [
    "/assets/exercise-db/Machine_Bicep_Curl/0.jpg",
    "/assets/exercise-db/Machine_Bicep_Curl/1.jpg"
  ],
  "Machine_Preacher_Curls": [
    "/assets/exercise-db/Machine_Preacher_Curls/0.jpg",
    "/assets/exercise-db/Machine_Preacher_Curls/1.jpg"
  ],
  "Machine_Shoulder_Military_Press": [
    "/assets/exercise-db/Machine_Shoulder_Military_Press/0.jpg",
    "/assets/exercise-db/Machine_Shoulder_Military_Press/1.jpg"
  ],
  "Machine_Triceps_Extension": [
    "/assets/exercise-db/Machine_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Machine_Triceps_Extension/1.jpg"
  ],
  "Medicine_Ball_Chest_Pass": [
    "/assets/exercise-db/Medicine_Ball_Chest_Pass/0.jpg",
    "/assets/exercise-db/Medicine_Ball_Chest_Pass/1.jpg"
  ],
  "Medicine_Ball_Full_Twist": [
    "/assets/exercise-db/Medicine_Ball_Full_Twist/0.jpg",
    "/assets/exercise-db/Medicine_Ball_Full_Twist/1.jpg"
  ],
  "Medicine_Ball_Scoop_Throw": [
    "/assets/exercise-db/Medicine_Ball_Scoop_Throw/0.jpg",
    "/assets/exercise-db/Medicine_Ball_Scoop_Throw/1.jpg"
  ],
  "Middle_Back_Shrug": [
    "/assets/exercise-db/Middle_Back_Shrug/0.jpg",
    "/assets/exercise-db/Middle_Back_Shrug/1.jpg"
  ],
  "Middle_Back_Stretch": [
    "/assets/exercise-db/Middle_Back_Stretch/0.jpg",
    "/assets/exercise-db/Middle_Back_Stretch/1.jpg"
  ],
  "Mixed_Grip_Chin": [
    "/assets/exercise-db/Mixed_Grip_Chin/0.jpg",
    "/assets/exercise-db/Mixed_Grip_Chin/1.jpg"
  ],
  "Monster_Walk": [
    "/assets/exercise-db/Monster_Walk/0.jpg",
    "/assets/exercise-db/Monster_Walk/1.jpg"
  ],
  "Mountain_Climbers": [
    "/assets/exercise-db/Mountain_Climbers/0.jpg",
    "/assets/exercise-db/Mountain_Climbers/1.jpg"
  ],
  "Moving_Claw_Series": [
    "/assets/exercise-db/Moving_Claw_Series/0.jpg",
    "/assets/exercise-db/Moving_Claw_Series/1.jpg"
  ],
  "Muscle_Snatch": [
    "/assets/exercise-db/Muscle_Snatch/0.jpg",
    "/assets/exercise-db/Muscle_Snatch/1.jpg"
  ],
  "Muscle_Up": [
    "/assets/exercise-db/Muscle_Up/0.jpg",
    "/assets/exercise-db/Muscle_Up/1.jpg"
  ],
  "Narrow_Stance_Hack_Squats": [
    "/assets/exercise-db/Narrow_Stance_Hack_Squats/0.jpg",
    "/assets/exercise-db/Narrow_Stance_Hack_Squats/1.jpg"
  ],
  "Narrow_Stance_Leg_Press": [
    "/assets/exercise-db/Narrow_Stance_Leg_Press/0.jpg",
    "/assets/exercise-db/Narrow_Stance_Leg_Press/1.jpg"
  ],
  "Narrow_Stance_Squats": [
    "/assets/exercise-db/Narrow_Stance_Squats/0.jpg",
    "/assets/exercise-db/Narrow_Stance_Squats/1.jpg"
  ],
  "Natural_Glute_Ham_Raise": [
    "/assets/exercise-db/Natural_Glute_Ham_Raise/0.jpg",
    "/assets/exercise-db/Natural_Glute_Ham_Raise/1.jpg"
  ],
  "Neck-SMR": [
    "/assets/exercise-db/Neck-SMR/0.jpg",
    "/assets/exercise-db/Neck-SMR/1.jpg"
  ],
  "Neck_Press": [
    "/assets/exercise-db/Neck_Press/0.jpg",
    "/assets/exercise-db/Neck_Press/1.jpg"
  ],
  "Oblique_Crunches": [
    "/assets/exercise-db/Oblique_Crunches/0.jpg",
    "/assets/exercise-db/Oblique_Crunches/1.jpg"
  ],
  "Oblique_Crunches_-_On_The_Floor": [
    "/assets/exercise-db/Oblique_Crunches_-_On_The_Floor/0.jpg",
    "/assets/exercise-db/Oblique_Crunches_-_On_The_Floor/1.jpg"
  ],
  "Olympic_Squat": [
    "/assets/exercise-db/Olympic_Squat/0.jpg",
    "/assets/exercise-db/Olympic_Squat/1.jpg"
  ],
  "On-Your-Back_Quad_Stretch": [
    "/assets/exercise-db/On-Your-Back_Quad_Stretch/0.jpg",
    "/assets/exercise-db/On-Your-Back_Quad_Stretch/1.jpg"
  ],
  "On_Your_Side_Quad_Stretch": [
    "/assets/exercise-db/On_Your_Side_Quad_Stretch/0.jpg",
    "/assets/exercise-db/On_Your_Side_Quad_Stretch/1.jpg"
  ],
  "One-Arm_Dumbbell_Row": [
    "/assets/exercise-db/One-Arm_Dumbbell_Row/0.jpg",
    "/assets/exercise-db/One-Arm_Dumbbell_Row/1.jpg"
  ],
  "One-Arm_Flat_Bench_Dumbbell_Flye": [
    "/assets/exercise-db/One-Arm_Flat_Bench_Dumbbell_Flye/0.jpg",
    "/assets/exercise-db/One-Arm_Flat_Bench_Dumbbell_Flye/1.jpg"
  ],
  "One-Arm_High-Pulley_Cable_Side_Bends": [
    "/assets/exercise-db/One-Arm_High-Pulley_Cable_Side_Bends/0.jpg",
    "/assets/exercise-db/One-Arm_High-Pulley_Cable_Side_Bends/1.jpg"
  ],
  "One-Arm_Incline_Lateral_Raise": [
    "/assets/exercise-db/One-Arm_Incline_Lateral_Raise/0.jpg",
    "/assets/exercise-db/One-Arm_Incline_Lateral_Raise/1.jpg"
  ],
  "One-Arm_Kettlebell_Clean": [
    "/assets/exercise-db/One-Arm_Kettlebell_Clean/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Clean/1.jpg"
  ],
  "One-Arm_Kettlebell_Clean_and_Jerk": [
    "/assets/exercise-db/One-Arm_Kettlebell_Clean_and_Jerk/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Clean_and_Jerk/1.jpg"
  ],
  "One-Arm_Kettlebell_Floor_Press": [
    "/assets/exercise-db/One-Arm_Kettlebell_Floor_Press/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Floor_Press/1.jpg"
  ],
  "One-Arm_Kettlebell_Jerk": [
    "/assets/exercise-db/One-Arm_Kettlebell_Jerk/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Jerk/1.jpg"
  ],
  "One-Arm_Kettlebell_Military_Press_To_The_Side": [
    "/assets/exercise-db/One-Arm_Kettlebell_Military_Press_To_The_Side/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Military_Press_To_The_Side/1.jpg"
  ],
  "One-Arm_Kettlebell_Para_Press": [
    "/assets/exercise-db/One-Arm_Kettlebell_Para_Press/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Para_Press/1.jpg"
  ],
  "One-Arm_Kettlebell_Push_Press": [
    "/assets/exercise-db/One-Arm_Kettlebell_Push_Press/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Push_Press/1.jpg"
  ],
  "One-Arm_Kettlebell_Row": [
    "/assets/exercise-db/One-Arm_Kettlebell_Row/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Row/1.jpg"
  ],
  "One-Arm_Kettlebell_Snatch": [
    "/assets/exercise-db/One-Arm_Kettlebell_Snatch/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Snatch/1.jpg"
  ],
  "One-Arm_Kettlebell_Split_Jerk": [
    "/assets/exercise-db/One-Arm_Kettlebell_Split_Jerk/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Split_Jerk/1.jpg"
  ],
  "One-Arm_Kettlebell_Split_Snatch": [
    "/assets/exercise-db/One-Arm_Kettlebell_Split_Snatch/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Split_Snatch/1.jpg"
  ],
  "One-Arm_Kettlebell_Swings": [
    "/assets/exercise-db/One-Arm_Kettlebell_Swings/0.jpg",
    "/assets/exercise-db/One-Arm_Kettlebell_Swings/1.jpg"
  ],
  "One-Arm_Long_Bar_Row": [
    "/assets/exercise-db/One-Arm_Long_Bar_Row/0.jpg",
    "/assets/exercise-db/One-Arm_Long_Bar_Row/1.jpg"
  ],
  "One-Arm_Medicine_Ball_Slam": [
    "/assets/exercise-db/One-Arm_Medicine_Ball_Slam/0.jpg",
    "/assets/exercise-db/One-Arm_Medicine_Ball_Slam/1.jpg"
  ],
  "One-Arm_Open_Palm_Kettlebell_Clean": [
    "/assets/exercise-db/One-Arm_Open_Palm_Kettlebell_Clean/0.jpg",
    "/assets/exercise-db/One-Arm_Open_Palm_Kettlebell_Clean/1.jpg"
  ],
  "One-Arm_Overhead_Kettlebell_Squats": [
    "/assets/exercise-db/One-Arm_Overhead_Kettlebell_Squats/0.jpg",
    "/assets/exercise-db/One-Arm_Overhead_Kettlebell_Squats/1.jpg"
  ],
  "One-Arm_Side_Deadlift": [
    "/assets/exercise-db/One-Arm_Side_Deadlift/0.jpg",
    "/assets/exercise-db/One-Arm_Side_Deadlift/1.jpg"
  ],
  "One-Arm_Side_Laterals": [
    "/assets/exercise-db/One-Arm_Side_Laterals/0.jpg",
    "/assets/exercise-db/One-Arm_Side_Laterals/1.jpg"
  ],
  "One-Legged_Cable_Kickback": [
    "/assets/exercise-db/One-Legged_Cable_Kickback/0.jpg",
    "/assets/exercise-db/One-Legged_Cable_Kickback/1.jpg"
  ],
  "One_Arm_Against_Wall": [
    "/assets/exercise-db/One_Arm_Against_Wall/0.jpg",
    "/assets/exercise-db/One_Arm_Against_Wall/1.jpg"
  ],
  "One_Arm_Chin-Up": [
    "/assets/exercise-db/One_Arm_Chin-Up/0.jpg",
    "/assets/exercise-db/One_Arm_Chin-Up/1.jpg"
  ],
  "One_Arm_Dumbbell_Bench_Press": [
    "/assets/exercise-db/One_Arm_Dumbbell_Bench_Press/0.jpg",
    "/assets/exercise-db/One_Arm_Dumbbell_Bench_Press/1.jpg"
  ],
  "One_Arm_Dumbbell_Preacher_Curl": [
    "/assets/exercise-db/One_Arm_Dumbbell_Preacher_Curl/0.jpg",
    "/assets/exercise-db/One_Arm_Dumbbell_Preacher_Curl/1.jpg"
  ],
  "One_Arm_Floor_Press": [
    "/assets/exercise-db/One_Arm_Floor_Press/0.jpg",
    "/assets/exercise-db/One_Arm_Floor_Press/1.jpg"
  ],
  "One_Arm_Lat_Pulldown": [
    "/assets/exercise-db/One_Arm_Lat_Pulldown/0.jpg",
    "/assets/exercise-db/One_Arm_Lat_Pulldown/1.jpg"
  ],
  "One_Arm_Pronated_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/One_Arm_Pronated_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/One_Arm_Pronated_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "One_Arm_Supinated_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/One_Arm_Supinated_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/One_Arm_Supinated_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "One_Half_Locust": [
    "/assets/exercise-db/One_Half_Locust/0.jpg",
    "/assets/exercise-db/One_Half_Locust/1.jpg"
  ],
  "One_Handed_Hang": [
    "/assets/exercise-db/One_Handed_Hang/0.jpg",
    "/assets/exercise-db/One_Handed_Hang/1.jpg"
  ],
  "One_Knee_To_Chest": [
    "/assets/exercise-db/One_Knee_To_Chest/0.jpg",
    "/assets/exercise-db/One_Knee_To_Chest/1.jpg"
  ],
  "One_Leg_Barbell_Squat": [
    "/assets/exercise-db/One_Leg_Barbell_Squat/0.jpg",
    "/assets/exercise-db/One_Leg_Barbell_Squat/1.jpg"
  ],
  "Open_Palm_Kettlebell_Clean": [
    "/assets/exercise-db/Open_Palm_Kettlebell_Clean/0.jpg",
    "/assets/exercise-db/Open_Palm_Kettlebell_Clean/1.jpg"
  ],
  "Otis-Up": [
    "/assets/exercise-db/Otis-Up/0.jpg",
    "/assets/exercise-db/Otis-Up/1.jpg"
  ],
  "Overhead_Cable_Curl": [
    "/assets/exercise-db/Overhead_Cable_Curl/0.jpg",
    "/assets/exercise-db/Overhead_Cable_Curl/1.jpg"
  ],
  "Overhead_Lat": [
    "/assets/exercise-db/Overhead_Lat/0.jpg",
    "/assets/exercise-db/Overhead_Lat/1.jpg"
  ],
  "Overhead_Slam": [
    "/assets/exercise-db/Overhead_Slam/0.jpg",
    "/assets/exercise-db/Overhead_Slam/1.jpg"
  ],
  "Overhead_Squat": [
    "/assets/exercise-db/Overhead_Squat/0.jpg",
    "/assets/exercise-db/Overhead_Squat/1.jpg"
  ],
  "Overhead_Stretch": [
    "/assets/exercise-db/Overhead_Stretch/0.jpg",
    "/assets/exercise-db/Overhead_Stretch/1.jpg"
  ],
  "Overhead_Triceps": [
    "/assets/exercise-db/Overhead_Triceps/0.jpg",
    "/assets/exercise-db/Overhead_Triceps/1.jpg"
  ],
  "Pallof_Press": [
    "/assets/exercise-db/Pallof_Press/0.jpg",
    "/assets/exercise-db/Pallof_Press/1.jpg"
  ],
  "Pallof_Press_With_Rotation": [
    "/assets/exercise-db/Pallof_Press_With_Rotation/0.jpg",
    "/assets/exercise-db/Pallof_Press_With_Rotation/1.jpg"
  ],
  "Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench": [
    "/assets/exercise-db/Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench/0.jpg",
    "/assets/exercise-db/Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench/1.jpg"
  ],
  "Palms-Down_Wrist_Curl_Over_A_Bench": [
    "/assets/exercise-db/Palms-Down_Wrist_Curl_Over_A_Bench/0.jpg",
    "/assets/exercise-db/Palms-Down_Wrist_Curl_Over_A_Bench/1.jpg"
  ],
  "Palms-Up_Barbell_Wrist_Curl_Over_A_Bench": [
    "/assets/exercise-db/Palms-Up_Barbell_Wrist_Curl_Over_A_Bench/0.jpg",
    "/assets/exercise-db/Palms-Up_Barbell_Wrist_Curl_Over_A_Bench/1.jpg"
  ],
  "Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench": [
    "/assets/exercise-db/Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench/0.jpg",
    "/assets/exercise-db/Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench/1.jpg"
  ],
  "Parallel_Bar_Dip": [
    "/assets/exercise-db/Parallel_Bar_Dip/0.jpg",
    "/assets/exercise-db/Parallel_Bar_Dip/1.jpg"
  ],
  "Pelvic_Tilt_Into_Bridge": [
    "/assets/exercise-db/Pelvic_Tilt_Into_Bridge/0.jpg",
    "/assets/exercise-db/Pelvic_Tilt_Into_Bridge/1.jpg"
  ],
  "Peroneals-SMR": [
    "/assets/exercise-db/Peroneals-SMR/0.jpg",
    "/assets/exercise-db/Peroneals-SMR/1.jpg"
  ],
  "Peroneals_Stretch": [
    "/assets/exercise-db/Peroneals_Stretch/0.jpg",
    "/assets/exercise-db/Peroneals_Stretch/1.jpg"
  ],
  "Physioball_Hip_Bridge": [
    "/assets/exercise-db/Physioball_Hip_Bridge/0.jpg",
    "/assets/exercise-db/Physioball_Hip_Bridge/1.jpg"
  ],
  "Pin_Presses": [
    "/assets/exercise-db/Pin_Presses/0.jpg",
    "/assets/exercise-db/Pin_Presses/1.jpg"
  ],
  "Piriformis-SMR": [
    "/assets/exercise-db/Piriformis-SMR/0.jpg",
    "/assets/exercise-db/Piriformis-SMR/1.jpg"
  ],
  "Plate_Pinch": [
    "/assets/exercise-db/Plate_Pinch/0.jpg",
    "/assets/exercise-db/Plate_Pinch/1.jpg"
  ],
  "Plate_Twist": [
    "/assets/exercise-db/Plate_Twist/0.jpg",
    "/assets/exercise-db/Plate_Twist/1.jpg"
  ],
  "Platform_Hamstring_Slides": [
    "/assets/exercise-db/Platform_Hamstring_Slides/0.jpg",
    "/assets/exercise-db/Platform_Hamstring_Slides/1.jpg"
  ],
  "Plie_Dumbbell_Squat": [
    "/assets/exercise-db/Plie_Dumbbell_Squat/0.jpg",
    "/assets/exercise-db/Plie_Dumbbell_Squat/1.jpg"
  ],
  "Plyo_Kettlebell_Pushups": [
    "/assets/exercise-db/Plyo_Kettlebell_Pushups/0.jpg",
    "/assets/exercise-db/Plyo_Kettlebell_Pushups/1.jpg"
  ],
  "Plyo_Push-up": [
    "/assets/exercise-db/Plyo_Push-up/0.jpg",
    "/assets/exercise-db/Plyo_Push-up/1.jpg"
  ],
  "Posterior_Tibialis_Stretch": [
    "/assets/exercise-db/Posterior_Tibialis_Stretch/0.jpg",
    "/assets/exercise-db/Posterior_Tibialis_Stretch/1.jpg"
  ],
  "Power_Clean": [
    "/assets/exercise-db/Power_Clean/0.jpg",
    "/assets/exercise-db/Power_Clean/1.jpg"
  ],
  "Power_Clean_from_Blocks": [
    "/assets/exercise-db/Power_Clean_from_Blocks/0.jpg",
    "/assets/exercise-db/Power_Clean_from_Blocks/1.jpg"
  ],
  "Power_Jerk": [
    "/assets/exercise-db/Power_Jerk/0.jpg",
    "/assets/exercise-db/Power_Jerk/1.jpg"
  ],
  "Power_Partials": [
    "/assets/exercise-db/Power_Partials/0.jpg",
    "/assets/exercise-db/Power_Partials/1.jpg"
  ],
  "Power_Snatch": [
    "/assets/exercise-db/Power_Snatch/0.jpg",
    "/assets/exercise-db/Power_Snatch/1.jpg"
  ],
  "Power_Snatch_from_Blocks": [
    "/assets/exercise-db/Power_Snatch_from_Blocks/0.jpg",
    "/assets/exercise-db/Power_Snatch_from_Blocks/1.jpg"
  ],
  "Power_Stairs": [
    "/assets/exercise-db/Power_Stairs/0.jpg",
    "/assets/exercise-db/Power_Stairs/1.jpg"
  ],
  "Preacher_Curl": [
    "/assets/exercise-db/Preacher_Curl/0.jpg",
    "/assets/exercise-db/Preacher_Curl/1.jpg"
  ],
  "Preacher_Hammer_Dumbbell_Curl": [
    "/assets/exercise-db/Preacher_Hammer_Dumbbell_Curl/0.jpg",
    "/assets/exercise-db/Preacher_Hammer_Dumbbell_Curl/1.jpg"
  ],
  "Press_Sit-Up": [
    "/assets/exercise-db/Press_Sit-Up/0.jpg",
    "/assets/exercise-db/Press_Sit-Up/1.jpg"
  ],
  "Prone_Manual_Hamstring": [
    "/assets/exercise-db/Prone_Manual_Hamstring/0.jpg",
    "/assets/exercise-db/Prone_Manual_Hamstring/1.jpg"
  ],
  "Prowler_Sprint": [
    "/assets/exercise-db/Prowler_Sprint/0.jpg",
    "/assets/exercise-db/Prowler_Sprint/1.jpg"
  ],
  "Pull_Through": [
    "/assets/exercise-db/Pull_Through/0.jpg",
    "/assets/exercise-db/Pull_Through/1.jpg"
  ],
  "Pullups": [
    "/assets/exercise-db/Pullups/0.jpg",
    "/assets/exercise-db/Pullups/1.jpg"
  ],
  "Push-Up_Wide": [
    "/assets/exercise-db/Push-Up_Wide/0.jpg",
    "/assets/exercise-db/Push-Up_Wide/1.jpg"
  ],
  "Push-Ups_-_Close_Triceps_Position": [
    "/assets/exercise-db/Push-Ups_-_Close_Triceps_Position/0.jpg",
    "/assets/exercise-db/Push-Ups_-_Close_Triceps_Position/1.jpg"
  ],
  "Push-Ups_With_Feet_Elevated": [
    "/assets/exercise-db/Push-Ups_With_Feet_Elevated/0.jpg",
    "/assets/exercise-db/Push-Ups_With_Feet_Elevated/1.jpg"
  ],
  "Push-Ups_With_Feet_On_An_Exercise_Ball": [
    "/assets/exercise-db/Push-Ups_With_Feet_On_An_Exercise_Ball/0.jpg",
    "/assets/exercise-db/Push-Ups_With_Feet_On_An_Exercise_Ball/1.jpg"
  ],
  "Push_Press": [
    "/assets/exercise-db/Push_Press/0.jpg",
    "/assets/exercise-db/Push_Press/1.jpg"
  ],
  "Push_Press_-_Behind_the_Neck": [
    "/assets/exercise-db/Push_Press_-_Behind_the_Neck/0.jpg",
    "/assets/exercise-db/Push_Press_-_Behind_the_Neck/1.jpg"
  ],
  "Push_Up_to_Side_Plank": [
    "/assets/exercise-db/Push_Up_to_Side_Plank/0.jpg",
    "/assets/exercise-db/Push_Up_to_Side_Plank/1.jpg"
  ],
  "Pushups": [
    "/assets/exercise-db/Pushups/0.jpg",
    "/assets/exercise-db/Pushups/1.jpg"
  ],
  "Pushups_Close_and_Wide_Hand_Positions": [
    "/assets/exercise-db/Pushups_Close_and_Wide_Hand_Positions/0.jpg",
    "/assets/exercise-db/Pushups_Close_and_Wide_Hand_Positions/1.jpg"
  ],
  "Pyramid": [
    "/assets/exercise-db/Pyramid/0.jpg",
    "/assets/exercise-db/Pyramid/1.jpg"
  ],
  "Quad_Stretch": [
    "/assets/exercise-db/Quad_Stretch/0.jpg",
    "/assets/exercise-db/Quad_Stretch/1.jpg"
  ],
  "Quadriceps-SMR": [
    "/assets/exercise-db/Quadriceps-SMR/0.jpg",
    "/assets/exercise-db/Quadriceps-SMR/1.jpg"
  ],
  "Quick_Leap": [
    "/assets/exercise-db/Quick_Leap/0.jpg",
    "/assets/exercise-db/Quick_Leap/1.jpg"
  ],
  "Rack_Delivery": [
    "/assets/exercise-db/Rack_Delivery/0.jpg",
    "/assets/exercise-db/Rack_Delivery/1.jpg"
  ],
  "Rack_Pull_with_Bands": [
    "/assets/exercise-db/Rack_Pull_with_Bands/0.jpg",
    "/assets/exercise-db/Rack_Pull_with_Bands/1.jpg"
  ],
  "Rack_Pulls": [
    "/assets/exercise-db/Rack_Pulls/0.jpg",
    "/assets/exercise-db/Rack_Pulls/1.jpg"
  ],
  "Rear_Leg_Raises": [
    "/assets/exercise-db/Rear_Leg_Raises/0.jpg",
    "/assets/exercise-db/Rear_Leg_Raises/1.jpg"
  ],
  "Recumbent_Bike": [
    "/assets/exercise-db/Recumbent_Bike/0.jpg",
    "/assets/exercise-db/Recumbent_Bike/1.jpg"
  ],
  "Return_Push_from_Stance": [
    "/assets/exercise-db/Return_Push_from_Stance/0.jpg",
    "/assets/exercise-db/Return_Push_from_Stance/1.jpg"
  ],
  "Reverse_Band_Bench_Press": [
    "/assets/exercise-db/Reverse_Band_Bench_Press/0.jpg",
    "/assets/exercise-db/Reverse_Band_Bench_Press/1.jpg"
  ],
  "Reverse_Band_Box_Squat": [
    "/assets/exercise-db/Reverse_Band_Box_Squat/0.jpg",
    "/assets/exercise-db/Reverse_Band_Box_Squat/1.jpg"
  ],
  "Reverse_Band_Deadlift": [
    "/assets/exercise-db/Reverse_Band_Deadlift/0.jpg",
    "/assets/exercise-db/Reverse_Band_Deadlift/1.jpg"
  ],
  "Reverse_Band_Power_Squat": [
    "/assets/exercise-db/Reverse_Band_Power_Squat/0.jpg",
    "/assets/exercise-db/Reverse_Band_Power_Squat/1.jpg"
  ],
  "Reverse_Band_Sumo_Deadlift": [
    "/assets/exercise-db/Reverse_Band_Sumo_Deadlift/0.jpg",
    "/assets/exercise-db/Reverse_Band_Sumo_Deadlift/1.jpg"
  ],
  "Reverse_Barbell_Curl": [
    "/assets/exercise-db/Reverse_Barbell_Curl/0.jpg",
    "/assets/exercise-db/Reverse_Barbell_Curl/1.jpg"
  ],
  "Reverse_Barbell_Preacher_Curls": [
    "/assets/exercise-db/Reverse_Barbell_Preacher_Curls/0.jpg",
    "/assets/exercise-db/Reverse_Barbell_Preacher_Curls/1.jpg"
  ],
  "Reverse_Cable_Curl": [
    "/assets/exercise-db/Reverse_Cable_Curl/0.jpg",
    "/assets/exercise-db/Reverse_Cable_Curl/1.jpg"
  ],
  "Reverse_Crunch": [
    "/assets/exercise-db/Reverse_Crunch/0.jpg",
    "/assets/exercise-db/Reverse_Crunch/1.jpg"
  ],
  "Reverse_Flyes": [
    "/assets/exercise-db/Reverse_Flyes/0.jpg",
    "/assets/exercise-db/Reverse_Flyes/1.jpg"
  ],
  "Reverse_Flyes_With_External_Rotation": [
    "/assets/exercise-db/Reverse_Flyes_With_External_Rotation/0.jpg",
    "/assets/exercise-db/Reverse_Flyes_With_External_Rotation/1.jpg"
  ],
  "Reverse_Grip_Bent-Over_Rows": [
    "/assets/exercise-db/Reverse_Grip_Bent-Over_Rows/0.jpg",
    "/assets/exercise-db/Reverse_Grip_Bent-Over_Rows/1.jpg"
  ],
  "Reverse_Grip_Triceps_Pushdown": [
    "/assets/exercise-db/Reverse_Grip_Triceps_Pushdown/0.jpg",
    "/assets/exercise-db/Reverse_Grip_Triceps_Pushdown/1.jpg"
  ],
  "Reverse_Hyperextension": [
    "/assets/exercise-db/Reverse_Hyperextension/0.jpg",
    "/assets/exercise-db/Reverse_Hyperextension/1.jpg"
  ],
  "Reverse_Machine_Flyes": [
    "/assets/exercise-db/Reverse_Machine_Flyes/0.jpg",
    "/assets/exercise-db/Reverse_Machine_Flyes/1.jpg"
  ],
  "Reverse_Plate_Curls": [
    "/assets/exercise-db/Reverse_Plate_Curls/0.jpg",
    "/assets/exercise-db/Reverse_Plate_Curls/1.jpg"
  ],
  "Reverse_Triceps_Bench_Press": [
    "/assets/exercise-db/Reverse_Triceps_Bench_Press/0.jpg",
    "/assets/exercise-db/Reverse_Triceps_Bench_Press/1.jpg"
  ],
  "Rhomboids-SMR": [
    "/assets/exercise-db/Rhomboids-SMR/0.jpg",
    "/assets/exercise-db/Rhomboids-SMR/1.jpg"
  ],
  "Rickshaw_Carry": [
    "/assets/exercise-db/Rickshaw_Carry/0.jpg",
    "/assets/exercise-db/Rickshaw_Carry/1.jpg"
  ],
  "Rickshaw_Deadlift": [
    "/assets/exercise-db/Rickshaw_Deadlift/0.jpg",
    "/assets/exercise-db/Rickshaw_Deadlift/1.jpg"
  ],
  "Ring_Dips": [
    "/assets/exercise-db/Ring_Dips/0.jpg",
    "/assets/exercise-db/Ring_Dips/1.jpg"
  ],
  "Rocket_Jump": [
    "/assets/exercise-db/Rocket_Jump/0.jpg",
    "/assets/exercise-db/Rocket_Jump/1.jpg"
  ],
  "Rocking_Standing_Calf_Raise": [
    "/assets/exercise-db/Rocking_Standing_Calf_Raise/0.jpg",
    "/assets/exercise-db/Rocking_Standing_Calf_Raise/1.jpg"
  ],
  "Rocky_Pull-Ups_Pulldowns": [
    "/assets/exercise-db/Rocky_Pull-Ups_Pulldowns/0.jpg",
    "/assets/exercise-db/Rocky_Pull-Ups_Pulldowns/1.jpg"
  ],
  "Romanian_Deadlift": [
    "/assets/exercise-db/Romanian_Deadlift/0.jpg",
    "/assets/exercise-db/Romanian_Deadlift/1.jpg"
  ],
  "Romanian_Deadlift_from_Deficit": [
    "/assets/exercise-db/Romanian_Deadlift_from_Deficit/0.jpg",
    "/assets/exercise-db/Romanian_Deadlift_from_Deficit/1.jpg"
  ],
  "Rope_Climb": [
    "/assets/exercise-db/Rope_Climb/0.jpg",
    "/assets/exercise-db/Rope_Climb/1.jpg"
  ],
  "Rope_Crunch": [
    "/assets/exercise-db/Rope_Crunch/0.jpg",
    "/assets/exercise-db/Rope_Crunch/1.jpg"
  ],
  "Rope_Jumping": [
    "/assets/exercise-db/Rope_Jumping/0.jpg",
    "/assets/exercise-db/Rope_Jumping/1.jpg"
  ],
  "Rope_Straight-Arm_Pulldown": [
    "/assets/exercise-db/Rope_Straight-Arm_Pulldown/0.jpg",
    "/assets/exercise-db/Rope_Straight-Arm_Pulldown/1.jpg"
  ],
  "Round_The_World_Shoulder_Stretch": [
    "/assets/exercise-db/Round_The_World_Shoulder_Stretch/0.jpg",
    "/assets/exercise-db/Round_The_World_Shoulder_Stretch/1.jpg"
  ],
  "Rowing_Stationary": [
    "/assets/exercise-db/Rowing_Stationary/0.jpg",
    "/assets/exercise-db/Rowing_Stationary/1.jpg"
  ],
  "Runners_Stretch": [
    "/assets/exercise-db/Runners_Stretch/0.jpg",
    "/assets/exercise-db/Runners_Stretch/1.jpg"
  ],
  "Running_Treadmill": [
    "/assets/exercise-db/Running_Treadmill/0.jpg",
    "/assets/exercise-db/Running_Treadmill/1.jpg"
  ],
  "Russian_Twist": [
    "/assets/exercise-db/Russian_Twist/0.jpg",
    "/assets/exercise-db/Russian_Twist/1.jpg"
  ],
  "Sandbag_Load": [
    "/assets/exercise-db/Sandbag_Load/0.jpg",
    "/assets/exercise-db/Sandbag_Load/1.jpg"
  ],
  "Scapular_Pull-Up": [
    "/assets/exercise-db/Scapular_Pull-Up/0.jpg",
    "/assets/exercise-db/Scapular_Pull-Up/1.jpg"
  ],
  "Scissor_Kick": [
    "/assets/exercise-db/Scissor_Kick/0.jpg",
    "/assets/exercise-db/Scissor_Kick/1.jpg"
  ],
  "Scissors_Jump": [
    "/assets/exercise-db/Scissors_Jump/0.jpg",
    "/assets/exercise-db/Scissors_Jump/1.jpg"
  ],
  "Seated_Band_Hamstring_Curl": [
    "/assets/exercise-db/Seated_Band_Hamstring_Curl/0.jpg",
    "/assets/exercise-db/Seated_Band_Hamstring_Curl/1.jpg"
  ],
  "Seated_Barbell_Military_Press": [
    "/assets/exercise-db/Seated_Barbell_Military_Press/0.jpg",
    "/assets/exercise-db/Seated_Barbell_Military_Press/1.jpg"
  ],
  "Seated_Barbell_Twist": [
    "/assets/exercise-db/Seated_Barbell_Twist/0.jpg",
    "/assets/exercise-db/Seated_Barbell_Twist/1.jpg"
  ],
  "Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "Seated_Bent-Over_Rear_Delt_Raise": [
    "/assets/exercise-db/Seated_Bent-Over_Rear_Delt_Raise/0.jpg",
    "/assets/exercise-db/Seated_Bent-Over_Rear_Delt_Raise/1.jpg"
  ],
  "Seated_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/Seated_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Seated_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "Seated_Biceps": [
    "/assets/exercise-db/Seated_Biceps/0.jpg",
    "/assets/exercise-db/Seated_Biceps/1.jpg"
  ],
  "Seated_Cable_Rows": [
    "/assets/exercise-db/Seated_Cable_Rows/0.jpg",
    "/assets/exercise-db/Seated_Cable_Rows/1.jpg"
  ],
  "Seated_Cable_Shoulder_Press": [
    "/assets/exercise-db/Seated_Cable_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Seated_Cable_Shoulder_Press/1.jpg"
  ],
  "Seated_Calf_Raise": [
    "/assets/exercise-db/Seated_Calf_Raise/0.jpg",
    "/assets/exercise-db/Seated_Calf_Raise/1.jpg"
  ],
  "Seated_Calf_Stretch": [
    "/assets/exercise-db/Seated_Calf_Stretch/0.jpg",
    "/assets/exercise-db/Seated_Calf_Stretch/1.jpg"
  ],
  "Seated_Close-Grip_Concentration_Barbell_Curl": [
    "/assets/exercise-db/Seated_Close-Grip_Concentration_Barbell_Curl/0.jpg",
    "/assets/exercise-db/Seated_Close-Grip_Concentration_Barbell_Curl/1.jpg"
  ],
  "Seated_Dumbbell_Curl": [
    "/assets/exercise-db/Seated_Dumbbell_Curl/0.jpg",
    "/assets/exercise-db/Seated_Dumbbell_Curl/1.jpg"
  ],
  "Seated_Dumbbell_Inner_Biceps_Curl": [
    "/assets/exercise-db/Seated_Dumbbell_Inner_Biceps_Curl/0.jpg",
    "/assets/exercise-db/Seated_Dumbbell_Inner_Biceps_Curl/1.jpg"
  ],
  "Seated_Dumbbell_Palms-Down_Wrist_Curl": [
    "/assets/exercise-db/Seated_Dumbbell_Palms-Down_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Seated_Dumbbell_Palms-Down_Wrist_Curl/1.jpg"
  ],
  "Seated_Dumbbell_Palms-Up_Wrist_Curl": [
    "/assets/exercise-db/Seated_Dumbbell_Palms-Up_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Seated_Dumbbell_Palms-Up_Wrist_Curl/1.jpg"
  ],
  "Seated_Dumbbell_Press": [
    "/assets/exercise-db/Seated_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Seated_Dumbbell_Press/1.jpg"
  ],
  "Seated_Flat_Bench_Leg_Pull-In": [
    "/assets/exercise-db/Seated_Flat_Bench_Leg_Pull-In/0.jpg",
    "/assets/exercise-db/Seated_Flat_Bench_Leg_Pull-In/1.jpg"
  ],
  "Seated_Floor_Hamstring_Stretch": [
    "/assets/exercise-db/Seated_Floor_Hamstring_Stretch/0.jpg",
    "/assets/exercise-db/Seated_Floor_Hamstring_Stretch/1.jpg"
  ],
  "Seated_Front_Deltoid": [
    "/assets/exercise-db/Seated_Front_Deltoid/0.jpg",
    "/assets/exercise-db/Seated_Front_Deltoid/1.jpg"
  ],
  "Seated_Glute": [
    "/assets/exercise-db/Seated_Glute/0.jpg",
    "/assets/exercise-db/Seated_Glute/1.jpg"
  ],
  "Seated_Good_Mornings": [
    "/assets/exercise-db/Seated_Good_Mornings/0.jpg",
    "/assets/exercise-db/Seated_Good_Mornings/1.jpg"
  ],
  "Seated_Hamstring": [
    "/assets/exercise-db/Seated_Hamstring/0.jpg",
    "/assets/exercise-db/Seated_Hamstring/1.jpg"
  ],
  "Seated_Hamstring_and_Calf_Stretch": [
    "/assets/exercise-db/Seated_Hamstring_and_Calf_Stretch/0.jpg",
    "/assets/exercise-db/Seated_Hamstring_and_Calf_Stretch/1.jpg"
  ],
  "Seated_Head_Harness_Neck_Resistance": [
    "/assets/exercise-db/Seated_Head_Harness_Neck_Resistance/0.jpg",
    "/assets/exercise-db/Seated_Head_Harness_Neck_Resistance/1.jpg"
  ],
  "Seated_Leg_Curl": [
    "/assets/exercise-db/Seated_Leg_Curl/0.jpg",
    "/assets/exercise-db/Seated_Leg_Curl/1.jpg"
  ],
  "Seated_Leg_Tucks": [
    "/assets/exercise-db/Seated_Leg_Tucks/0.jpg",
    "/assets/exercise-db/Seated_Leg_Tucks/1.jpg"
  ],
  "Seated_One-Arm_Dumbbell_Palms-Down_Wrist_Curl": [
    "/assets/exercise-db/Seated_One-Arm_Dumbbell_Palms-Down_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Seated_One-Arm_Dumbbell_Palms-Down_Wrist_Curl/1.jpg"
  ],
  "Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl": [
    "/assets/exercise-db/Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl/1.jpg"
  ],
  "Seated_One-arm_Cable_Pulley_Rows": [
    "/assets/exercise-db/Seated_One-arm_Cable_Pulley_Rows/0.jpg",
    "/assets/exercise-db/Seated_One-arm_Cable_Pulley_Rows/1.jpg"
  ],
  "Seated_Overhead_Stretch": [
    "/assets/exercise-db/Seated_Overhead_Stretch/0.jpg",
    "/assets/exercise-db/Seated_Overhead_Stretch/1.jpg"
  ],
  "Seated_Palm-Up_Barbell_Wrist_Curl": [
    "/assets/exercise-db/Seated_Palm-Up_Barbell_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Seated_Palm-Up_Barbell_Wrist_Curl/1.jpg"
  ],
  "Seated_Palms-Down_Barbell_Wrist_Curl": [
    "/assets/exercise-db/Seated_Palms-Down_Barbell_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Seated_Palms-Down_Barbell_Wrist_Curl/1.jpg"
  ],
  "Seated_Side_Lateral_Raise": [
    "/assets/exercise-db/Seated_Side_Lateral_Raise/0.jpg",
    "/assets/exercise-db/Seated_Side_Lateral_Raise/1.jpg"
  ],
  "Seated_Triceps_Press": [
    "/assets/exercise-db/Seated_Triceps_Press/0.jpg",
    "/assets/exercise-db/Seated_Triceps_Press/1.jpg"
  ],
  "Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl": [
    "/assets/exercise-db/Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl/1.jpg"
  ],
  "See-Saw_Press_Alternating_Side_Press": [
    "/assets/exercise-db/See-Saw_Press_Alternating_Side_Press/0.jpg",
    "/assets/exercise-db/See-Saw_Press_Alternating_Side_Press/1.jpg"
  ],
  "Shotgun_Row": [
    "/assets/exercise-db/Shotgun_Row/0.jpg",
    "/assets/exercise-db/Shotgun_Row/1.jpg"
  ],
  "Shoulder_Circles": [
    "/assets/exercise-db/Shoulder_Circles/0.jpg",
    "/assets/exercise-db/Shoulder_Circles/1.jpg"
  ],
  "Shoulder_Press_-_With_Bands": [
    "/assets/exercise-db/Shoulder_Press_-_With_Bands/0.jpg",
    "/assets/exercise-db/Shoulder_Press_-_With_Bands/1.jpg"
  ],
  "Shoulder_Raise": [
    "/assets/exercise-db/Shoulder_Raise/0.jpg",
    "/assets/exercise-db/Shoulder_Raise/1.jpg"
  ],
  "Shoulder_Stretch": [
    "/assets/exercise-db/Shoulder_Stretch/0.jpg",
    "/assets/exercise-db/Shoulder_Stretch/1.jpg"
  ],
  "Side-Lying_Floor_Stretch": [
    "/assets/exercise-db/Side-Lying_Floor_Stretch/0.jpg",
    "/assets/exercise-db/Side-Lying_Floor_Stretch/1.jpg"
  ],
  "Side_Bridge": [
    "/assets/exercise-db/Side_Bridge/0.jpg",
    "/assets/exercise-db/Side_Bridge/1.jpg"
  ],
  "Side_Hop-Sprint": [
    "/assets/exercise-db/Side_Hop-Sprint/0.jpg",
    "/assets/exercise-db/Side_Hop-Sprint/1.jpg"
  ],
  "Side_Jackknife": [
    "/assets/exercise-db/Side_Jackknife/0.jpg",
    "/assets/exercise-db/Side_Jackknife/1.jpg"
  ],
  "Side_Lateral_Raise": [
    "/assets/exercise-db/Side_Lateral_Raise/0.jpg",
    "/assets/exercise-db/Side_Lateral_Raise/1.jpg"
  ],
  "Side_Laterals_to_Front_Raise": [
    "/assets/exercise-db/Side_Laterals_to_Front_Raise/0.jpg",
    "/assets/exercise-db/Side_Laterals_to_Front_Raise/1.jpg"
  ],
  "Side_Leg_Raises": [
    "/assets/exercise-db/Side_Leg_Raises/0.jpg",
    "/assets/exercise-db/Side_Leg_Raises/1.jpg"
  ],
  "Side_Lying_Groin_Stretch": [
    "/assets/exercise-db/Side_Lying_Groin_Stretch/0.jpg",
    "/assets/exercise-db/Side_Lying_Groin_Stretch/1.jpg"
  ],
  "Side_Neck_Stretch": [
    "/assets/exercise-db/Side_Neck_Stretch/0.jpg",
    "/assets/exercise-db/Side_Neck_Stretch/1.jpg"
  ],
  "Side_Standing_Long_Jump": [
    "/assets/exercise-db/Side_Standing_Long_Jump/0.jpg",
    "/assets/exercise-db/Side_Standing_Long_Jump/1.jpg"
  ],
  "Side_To_Side_Chins": [
    "/assets/exercise-db/Side_To_Side_Chins/0.jpg",
    "/assets/exercise-db/Side_To_Side_Chins/1.jpg"
  ],
  "Side_Wrist_Pull": [
    "/assets/exercise-db/Side_Wrist_Pull/0.jpg",
    "/assets/exercise-db/Side_Wrist_Pull/1.jpg"
  ],
  "Side_to_Side_Box_Shuffle": [
    "/assets/exercise-db/Side_to_Side_Box_Shuffle/0.jpg",
    "/assets/exercise-db/Side_to_Side_Box_Shuffle/1.jpg"
  ],
  "Single-Arm_Cable_Crossover": [
    "/assets/exercise-db/Single-Arm_Cable_Crossover/0.jpg",
    "/assets/exercise-db/Single-Arm_Cable_Crossover/1.jpg"
  ],
  "Single-Arm_Linear_Jammer": [
    "/assets/exercise-db/Single-Arm_Linear_Jammer/0.jpg",
    "/assets/exercise-db/Single-Arm_Linear_Jammer/1.jpg"
  ],
  "Single-Arm_Push-Up": [
    "/assets/exercise-db/Single-Arm_Push-Up/0.jpg",
    "/assets/exercise-db/Single-Arm_Push-Up/1.jpg"
  ],
  "Single-Cone_Sprint_Drill": [
    "/assets/exercise-db/Single-Cone_Sprint_Drill/0.jpg",
    "/assets/exercise-db/Single-Cone_Sprint_Drill/1.jpg"
  ],
  "Single-Leg_High_Box_Squat": [
    "/assets/exercise-db/Single-Leg_High_Box_Squat/0.jpg",
    "/assets/exercise-db/Single-Leg_High_Box_Squat/1.jpg"
  ],
  "Single-Leg_Hop_Progression": [
    "/assets/exercise-db/Single-Leg_Hop_Progression/0.jpg",
    "/assets/exercise-db/Single-Leg_Hop_Progression/1.jpg"
  ],
  "Single-Leg_Lateral_Hop": [
    "/assets/exercise-db/Single-Leg_Lateral_Hop/0.jpg",
    "/assets/exercise-db/Single-Leg_Lateral_Hop/1.jpg"
  ],
  "Single-Leg_Leg_Extension": [
    "/assets/exercise-db/Single-Leg_Leg_Extension/0.jpg",
    "/assets/exercise-db/Single-Leg_Leg_Extension/1.jpg"
  ],
  "Single-Leg_Stride_Jump": [
    "/assets/exercise-db/Single-Leg_Stride_Jump/0.jpg",
    "/assets/exercise-db/Single-Leg_Stride_Jump/1.jpg"
  ],
  "Single_Dumbbell_Raise": [
    "/assets/exercise-db/Single_Dumbbell_Raise/0.jpg",
    "/assets/exercise-db/Single_Dumbbell_Raise/1.jpg"
  ],
  "Single_Leg_Butt_Kick": [
    "/assets/exercise-db/Single_Leg_Butt_Kick/0.jpg",
    "/assets/exercise-db/Single_Leg_Butt_Kick/1.jpg"
  ],
  "Single_Leg_Glute_Bridge": [
    "/assets/exercise-db/Single_Leg_Glute_Bridge/0.jpg",
    "/assets/exercise-db/Single_Leg_Glute_Bridge/1.jpg"
  ],
  "Single_Leg_Push-off": [
    "/assets/exercise-db/Single_Leg_Push-off/0.jpg",
    "/assets/exercise-db/Single_Leg_Push-off/1.jpg"
  ],
  "Sit_Squats": [
    "/assets/exercise-db/Sit_Squats/0.jpg",
    "/assets/exercise-db/Sit_Squats/1.jpg"
  ],
  "Skating": [
    "/assets/exercise-db/Skating/0.jpg",
    "/assets/exercise-db/Skating/1.jpg"
  ],
  "Sled_Drag_-_Harness": [
    "/assets/exercise-db/Sled_Drag_-_Harness/0.jpg",
    "/assets/exercise-db/Sled_Drag_-_Harness/1.jpg"
  ],
  "Sled_Overhead_Backward_Walk": [
    "/assets/exercise-db/Sled_Overhead_Backward_Walk/0.jpg",
    "/assets/exercise-db/Sled_Overhead_Backward_Walk/1.jpg"
  ],
  "Sled_Overhead_Triceps_Extension": [
    "/assets/exercise-db/Sled_Overhead_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Sled_Overhead_Triceps_Extension/1.jpg"
  ],
  "Sled_Push": [
    "/assets/exercise-db/Sled_Push/0.jpg",
    "/assets/exercise-db/Sled_Push/1.jpg"
  ],
  "Sled_Reverse_Flye": [
    "/assets/exercise-db/Sled_Reverse_Flye/0.jpg",
    "/assets/exercise-db/Sled_Reverse_Flye/1.jpg"
  ],
  "Sled_Row": [
    "/assets/exercise-db/Sled_Row/0.jpg",
    "/assets/exercise-db/Sled_Row/1.jpg"
  ],
  "Sledgehammer_Swings": [
    "/assets/exercise-db/Sledgehammer_Swings/0.jpg",
    "/assets/exercise-db/Sledgehammer_Swings/1.jpg"
  ],
  "Smith_Incline_Shoulder_Raise": [
    "/assets/exercise-db/Smith_Incline_Shoulder_Raise/0.jpg",
    "/assets/exercise-db/Smith_Incline_Shoulder_Raise/1.jpg"
  ],
  "Smith_Machine_Behind_the_Back_Shrug": [
    "/assets/exercise-db/Smith_Machine_Behind_the_Back_Shrug/0.jpg",
    "/assets/exercise-db/Smith_Machine_Behind_the_Back_Shrug/1.jpg"
  ],
  "Smith_Machine_Bench_Press": [
    "/assets/exercise-db/Smith_Machine_Bench_Press/0.jpg",
    "/assets/exercise-db/Smith_Machine_Bench_Press/1.jpg"
  ],
  "Smith_Machine_Bent_Over_Row": [
    "/assets/exercise-db/Smith_Machine_Bent_Over_Row/0.jpg",
    "/assets/exercise-db/Smith_Machine_Bent_Over_Row/1.jpg"
  ],
  "Smith_Machine_Calf_Raise": [
    "/assets/exercise-db/Smith_Machine_Calf_Raise/0.jpg",
    "/assets/exercise-db/Smith_Machine_Calf_Raise/1.jpg"
  ],
  "Smith_Machine_Close-Grip_Bench_Press": [
    "/assets/exercise-db/Smith_Machine_Close-Grip_Bench_Press/0.jpg",
    "/assets/exercise-db/Smith_Machine_Close-Grip_Bench_Press/1.jpg"
  ],
  "Smith_Machine_Decline_Press": [
    "/assets/exercise-db/Smith_Machine_Decline_Press/0.jpg",
    "/assets/exercise-db/Smith_Machine_Decline_Press/1.jpg"
  ],
  "Smith_Machine_Hang_Power_Clean": [
    "/assets/exercise-db/Smith_Machine_Hang_Power_Clean/0.jpg",
    "/assets/exercise-db/Smith_Machine_Hang_Power_Clean/1.jpg"
  ],
  "Smith_Machine_Hip_Raise": [
    "/assets/exercise-db/Smith_Machine_Hip_Raise/0.jpg",
    "/assets/exercise-db/Smith_Machine_Hip_Raise/1.jpg"
  ],
  "Smith_Machine_Incline_Bench_Press": [
    "/assets/exercise-db/Smith_Machine_Incline_Bench_Press/0.jpg",
    "/assets/exercise-db/Smith_Machine_Incline_Bench_Press/1.jpg"
  ],
  "Smith_Machine_Leg_Press": [
    "/assets/exercise-db/Smith_Machine_Leg_Press/0.jpg",
    "/assets/exercise-db/Smith_Machine_Leg_Press/1.jpg"
  ],
  "Smith_Machine_One-Arm_Upright_Row": [
    "/assets/exercise-db/Smith_Machine_One-Arm_Upright_Row/0.jpg",
    "/assets/exercise-db/Smith_Machine_One-Arm_Upright_Row/1.jpg"
  ],
  "Smith_Machine_Overhead_Shoulder_Press": [
    "/assets/exercise-db/Smith_Machine_Overhead_Shoulder_Press/0.jpg",
    "/assets/exercise-db/Smith_Machine_Overhead_Shoulder_Press/1.jpg"
  ],
  "Smith_Machine_Pistol_Squat": [
    "/assets/exercise-db/Smith_Machine_Pistol_Squat/0.jpg",
    "/assets/exercise-db/Smith_Machine_Pistol_Squat/1.jpg"
  ],
  "Smith_Machine_Reverse_Calf_Raises": [
    "/assets/exercise-db/Smith_Machine_Reverse_Calf_Raises/0.jpg",
    "/assets/exercise-db/Smith_Machine_Reverse_Calf_Raises/1.jpg"
  ],
  "Smith_Machine_Squat": [
    "/assets/exercise-db/Smith_Machine_Squat/0.jpg",
    "/assets/exercise-db/Smith_Machine_Squat/1.jpg"
  ],
  "Smith_Machine_Stiff-Legged_Deadlift": [
    "/assets/exercise-db/Smith_Machine_Stiff-Legged_Deadlift/0.jpg",
    "/assets/exercise-db/Smith_Machine_Stiff-Legged_Deadlift/1.jpg"
  ],
  "Smith_Machine_Upright_Row": [
    "/assets/exercise-db/Smith_Machine_Upright_Row/0.jpg",
    "/assets/exercise-db/Smith_Machine_Upright_Row/1.jpg"
  ],
  "Smith_Single-Leg_Split_Squat": [
    "/assets/exercise-db/Smith_Single-Leg_Split_Squat/0.jpg",
    "/assets/exercise-db/Smith_Single-Leg_Split_Squat/1.jpg"
  ],
  "Snatch": [
    "/assets/exercise-db/Snatch/0.jpg",
    "/assets/exercise-db/Snatch/1.jpg"
  ],
  "Snatch_Balance": [
    "/assets/exercise-db/Snatch_Balance/0.jpg",
    "/assets/exercise-db/Snatch_Balance/1.jpg"
  ],
  "Snatch_Deadlift": [
    "/assets/exercise-db/Snatch_Deadlift/0.jpg",
    "/assets/exercise-db/Snatch_Deadlift/1.jpg"
  ],
  "Snatch_Pull": [
    "/assets/exercise-db/Snatch_Pull/0.jpg",
    "/assets/exercise-db/Snatch_Pull/1.jpg"
  ],
  "Snatch_Shrug": [
    "/assets/exercise-db/Snatch_Shrug/0.jpg",
    "/assets/exercise-db/Snatch_Shrug/1.jpg"
  ],
  "Snatch_from_Blocks": [
    "/assets/exercise-db/Snatch_from_Blocks/0.jpg",
    "/assets/exercise-db/Snatch_from_Blocks/1.jpg"
  ],
  "Speed_Band_Overhead_Triceps": [
    "/assets/exercise-db/Speed_Band_Overhead_Triceps/0.jpg",
    "/assets/exercise-db/Speed_Band_Overhead_Triceps/1.jpg"
  ],
  "Speed_Box_Squat": [
    "/assets/exercise-db/Speed_Box_Squat/0.jpg",
    "/assets/exercise-db/Speed_Box_Squat/1.jpg"
  ],
  "Speed_Squats": [
    "/assets/exercise-db/Speed_Squats/0.jpg",
    "/assets/exercise-db/Speed_Squats/1.jpg"
  ],
  "Spell_Caster": [
    "/assets/exercise-db/Spell_Caster/0.jpg",
    "/assets/exercise-db/Spell_Caster/1.jpg"
  ],
  "Spider_Crawl": [
    "/assets/exercise-db/Spider_Crawl/0.jpg",
    "/assets/exercise-db/Spider_Crawl/1.jpg"
  ],
  "Spider_Curl": [
    "/assets/exercise-db/Spider_Curl/0.jpg",
    "/assets/exercise-db/Spider_Curl/1.jpg"
  ],
  "Spinal_Stretch": [
    "/assets/exercise-db/Spinal_Stretch/0.jpg",
    "/assets/exercise-db/Spinal_Stretch/1.jpg"
  ],
  "Split_Clean": [
    "/assets/exercise-db/Split_Clean/0.jpg",
    "/assets/exercise-db/Split_Clean/1.jpg"
  ],
  "Split_Jerk": [
    "/assets/exercise-db/Split_Jerk/0.jpg",
    "/assets/exercise-db/Split_Jerk/1.jpg"
  ],
  "Split_Jump": [
    "/assets/exercise-db/Split_Jump/0.jpg",
    "/assets/exercise-db/Split_Jump/1.jpg"
  ],
  "Split_Snatch": [
    "/assets/exercise-db/Split_Snatch/0.jpg",
    "/assets/exercise-db/Split_Snatch/1.jpg"
  ],
  "Split_Squat_with_Dumbbells": [
    "/assets/exercise-db/Split_Squat_with_Dumbbells/0.jpg",
    "/assets/exercise-db/Split_Squat_with_Dumbbells/1.jpg"
  ],
  "Split_Squats": [
    "/assets/exercise-db/Split_Squats/0.jpg",
    "/assets/exercise-db/Split_Squats/1.jpg"
  ],
  "Squat_Jerk": [
    "/assets/exercise-db/Squat_Jerk/0.jpg",
    "/assets/exercise-db/Squat_Jerk/1.jpg"
  ],
  "Squat_with_Bands": [
    "/assets/exercise-db/Squat_with_Bands/0.jpg",
    "/assets/exercise-db/Squat_with_Bands/1.jpg"
  ],
  "Squat_with_Chains": [
    "/assets/exercise-db/Squat_with_Chains/0.jpg",
    "/assets/exercise-db/Squat_with_Chains/1.jpg"
  ],
  "Squat_with_Plate_Movers": [
    "/assets/exercise-db/Squat_with_Plate_Movers/0.jpg",
    "/assets/exercise-db/Squat_with_Plate_Movers/1.jpg"
  ],
  "Squats_-_With_Bands": [
    "/assets/exercise-db/Squats_-_With_Bands/0.jpg",
    "/assets/exercise-db/Squats_-_With_Bands/1.jpg"
  ],
  "Stairmaster": [
    "/assets/exercise-db/Stairmaster/0.jpg",
    "/assets/exercise-db/Stairmaster/1.jpg"
  ],
  "Standing_Alternating_Dumbbell_Press": [
    "/assets/exercise-db/Standing_Alternating_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Standing_Alternating_Dumbbell_Press/1.jpg"
  ],
  "Standing_Barbell_Calf_Raise": [
    "/assets/exercise-db/Standing_Barbell_Calf_Raise/0.jpg",
    "/assets/exercise-db/Standing_Barbell_Calf_Raise/1.jpg"
  ],
  "Standing_Barbell_Press_Behind_Neck": [
    "/assets/exercise-db/Standing_Barbell_Press_Behind_Neck/0.jpg",
    "/assets/exercise-db/Standing_Barbell_Press_Behind_Neck/1.jpg"
  ],
  "Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "Standing_Biceps_Cable_Curl": [
    "/assets/exercise-db/Standing_Biceps_Cable_Curl/0.jpg",
    "/assets/exercise-db/Standing_Biceps_Cable_Curl/1.jpg"
  ],
  "Standing_Biceps_Stretch": [
    "/assets/exercise-db/Standing_Biceps_Stretch/0.jpg",
    "/assets/exercise-db/Standing_Biceps_Stretch/1.jpg"
  ],
  "Standing_Bradford_Press": [
    "/assets/exercise-db/Standing_Bradford_Press/0.jpg",
    "/assets/exercise-db/Standing_Bradford_Press/1.jpg"
  ],
  "Standing_Cable_Chest_Press": [
    "/assets/exercise-db/Standing_Cable_Chest_Press/0.jpg",
    "/assets/exercise-db/Standing_Cable_Chest_Press/1.jpg"
  ],
  "Standing_Cable_Lift": [
    "/assets/exercise-db/Standing_Cable_Lift/0.jpg",
    "/assets/exercise-db/Standing_Cable_Lift/1.jpg"
  ],
  "Standing_Cable_Wood_Chop": [
    "/assets/exercise-db/Standing_Cable_Wood_Chop/0.jpg",
    "/assets/exercise-db/Standing_Cable_Wood_Chop/1.jpg"
  ],
  "Standing_Calf_Raises": [
    "/assets/exercise-db/Standing_Calf_Raises/0.jpg",
    "/assets/exercise-db/Standing_Calf_Raises/1.jpg"
  ],
  "Standing_Concentration_Curl": [
    "/assets/exercise-db/Standing_Concentration_Curl/0.jpg",
    "/assets/exercise-db/Standing_Concentration_Curl/1.jpg"
  ],
  "Standing_Dumbbell_Calf_Raise": [
    "/assets/exercise-db/Standing_Dumbbell_Calf_Raise/0.jpg",
    "/assets/exercise-db/Standing_Dumbbell_Calf_Raise/1.jpg"
  ],
  "Standing_Dumbbell_Press": [
    "/assets/exercise-db/Standing_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Standing_Dumbbell_Press/1.jpg"
  ],
  "Standing_Dumbbell_Reverse_Curl": [
    "/assets/exercise-db/Standing_Dumbbell_Reverse_Curl/0.jpg",
    "/assets/exercise-db/Standing_Dumbbell_Reverse_Curl/1.jpg"
  ],
  "Standing_Dumbbell_Straight-Arm_Front_Delt_Raise_Above_Head": [
    "/assets/exercise-db/Standing_Dumbbell_Straight-Arm_Front_Delt_Raise_Above_Head/0.jpg",
    "/assets/exercise-db/Standing_Dumbbell_Straight-Arm_Front_Delt_Raise_Above_Head/1.jpg"
  ],
  "Standing_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/Standing_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Standing_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "Standing_Dumbbell_Upright_Row": [
    "/assets/exercise-db/Standing_Dumbbell_Upright_Row/0.jpg",
    "/assets/exercise-db/Standing_Dumbbell_Upright_Row/1.jpg"
  ],
  "Standing_Elevated_Quad_Stretch": [
    "/assets/exercise-db/Standing_Elevated_Quad_Stretch/0.jpg",
    "/assets/exercise-db/Standing_Elevated_Quad_Stretch/1.jpg"
  ],
  "Standing_Front_Barbell_Raise_Over_Head": [
    "/assets/exercise-db/Standing_Front_Barbell_Raise_Over_Head/0.jpg",
    "/assets/exercise-db/Standing_Front_Barbell_Raise_Over_Head/1.jpg"
  ],
  "Standing_Gastrocnemius_Calf_Stretch": [
    "/assets/exercise-db/Standing_Gastrocnemius_Calf_Stretch/0.jpg",
    "/assets/exercise-db/Standing_Gastrocnemius_Calf_Stretch/1.jpg"
  ],
  "Standing_Hamstring_and_Calf_Stretch": [
    "/assets/exercise-db/Standing_Hamstring_and_Calf_Stretch/0.jpg",
    "/assets/exercise-db/Standing_Hamstring_and_Calf_Stretch/1.jpg"
  ],
  "Standing_Hip_Circles": [
    "/assets/exercise-db/Standing_Hip_Circles/0.jpg",
    "/assets/exercise-db/Standing_Hip_Circles/1.jpg"
  ],
  "Standing_Hip_Flexors": [
    "/assets/exercise-db/Standing_Hip_Flexors/0.jpg",
    "/assets/exercise-db/Standing_Hip_Flexors/1.jpg"
  ],
  "Standing_Inner-Biceps_Curl": [
    "/assets/exercise-db/Standing_Inner-Biceps_Curl/0.jpg",
    "/assets/exercise-db/Standing_Inner-Biceps_Curl/1.jpg"
  ],
  "Standing_Lateral_Stretch": [
    "/assets/exercise-db/Standing_Lateral_Stretch/0.jpg",
    "/assets/exercise-db/Standing_Lateral_Stretch/1.jpg"
  ],
  "Standing_Leg_Curl": [
    "/assets/exercise-db/Standing_Leg_Curl/0.jpg",
    "/assets/exercise-db/Standing_Leg_Curl/1.jpg"
  ],
  "Standing_Long_Jump": [
    "/assets/exercise-db/Standing_Long_Jump/0.jpg",
    "/assets/exercise-db/Standing_Long_Jump/1.jpg"
  ],
  "Standing_Low-Pulley_Deltoid_Raise": [
    "/assets/exercise-db/Standing_Low-Pulley_Deltoid_Raise/0.jpg",
    "/assets/exercise-db/Standing_Low-Pulley_Deltoid_Raise/1.jpg"
  ],
  "Standing_Low-Pulley_One-Arm_Triceps_Extension": [
    "/assets/exercise-db/Standing_Low-Pulley_One-Arm_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Standing_Low-Pulley_One-Arm_Triceps_Extension/1.jpg"
  ],
  "Standing_Military_Press": [
    "/assets/exercise-db/Standing_Military_Press/0.jpg",
    "/assets/exercise-db/Standing_Military_Press/1.jpg"
  ],
  "Standing_Olympic_Plate_Hand_Squeeze": [
    "/assets/exercise-db/Standing_Olympic_Plate_Hand_Squeeze/0.jpg",
    "/assets/exercise-db/Standing_Olympic_Plate_Hand_Squeeze/1.jpg"
  ],
  "Standing_One-Arm_Cable_Curl": [
    "/assets/exercise-db/Standing_One-Arm_Cable_Curl/0.jpg",
    "/assets/exercise-db/Standing_One-Arm_Cable_Curl/1.jpg"
  ],
  "Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench": [
    "/assets/exercise-db/Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench/0.jpg",
    "/assets/exercise-db/Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench/1.jpg"
  ],
  "Standing_One-Arm_Dumbbell_Triceps_Extension": [
    "/assets/exercise-db/Standing_One-Arm_Dumbbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Standing_One-Arm_Dumbbell_Triceps_Extension/1.jpg"
  ],
  "Standing_Overhead_Barbell_Triceps_Extension": [
    "/assets/exercise-db/Standing_Overhead_Barbell_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Standing_Overhead_Barbell_Triceps_Extension/1.jpg"
  ],
  "Standing_Palm-In_One-Arm_Dumbbell_Press": [
    "/assets/exercise-db/Standing_Palm-In_One-Arm_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Standing_Palm-In_One-Arm_Dumbbell_Press/1.jpg"
  ],
  "Standing_Palms-In_Dumbbell_Press": [
    "/assets/exercise-db/Standing_Palms-In_Dumbbell_Press/0.jpg",
    "/assets/exercise-db/Standing_Palms-In_Dumbbell_Press/1.jpg"
  ],
  "Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl": [
    "/assets/exercise-db/Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl/0.jpg",
    "/assets/exercise-db/Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl/1.jpg"
  ],
  "Standing_Pelvic_Tilt": [
    "/assets/exercise-db/Standing_Pelvic_Tilt/0.jpg",
    "/assets/exercise-db/Standing_Pelvic_Tilt/1.jpg"
  ],
  "Standing_Rope_Crunch": [
    "/assets/exercise-db/Standing_Rope_Crunch/0.jpg",
    "/assets/exercise-db/Standing_Rope_Crunch/1.jpg"
  ],
  "Standing_Soleus_And_Achilles_Stretch": [
    "/assets/exercise-db/Standing_Soleus_And_Achilles_Stretch/0.jpg",
    "/assets/exercise-db/Standing_Soleus_And_Achilles_Stretch/1.jpg"
  ],
  "Standing_Toe_Touches": [
    "/assets/exercise-db/Standing_Toe_Touches/0.jpg",
    "/assets/exercise-db/Standing_Toe_Touches/1.jpg"
  ],
  "Standing_Towel_Triceps_Extension": [
    "/assets/exercise-db/Standing_Towel_Triceps_Extension/0.jpg",
    "/assets/exercise-db/Standing_Towel_Triceps_Extension/1.jpg"
  ],
  "Standing_Two-Arm_Overhead_Throw": [
    "/assets/exercise-db/Standing_Two-Arm_Overhead_Throw/0.jpg",
    "/assets/exercise-db/Standing_Two-Arm_Overhead_Throw/1.jpg"
  ],
  "Star_Jump": [
    "/assets/exercise-db/Star_Jump/0.jpg",
    "/assets/exercise-db/Star_Jump/1.jpg"
  ],
  "Step-up_with_Knee_Raise": [
    "/assets/exercise-db/Step-up_with_Knee_Raise/0.jpg",
    "/assets/exercise-db/Step-up_with_Knee_Raise/1.jpg"
  ],
  "Step_Mill": [
    "/assets/exercise-db/Step_Mill/0.jpg",
    "/assets/exercise-db/Step_Mill/1.jpg"
  ],
  "Stiff-Legged_Barbell_Deadlift": [
    "/assets/exercise-db/Stiff-Legged_Barbell_Deadlift/0.jpg",
    "/assets/exercise-db/Stiff-Legged_Barbell_Deadlift/1.jpg"
  ],
  "Stiff-Legged_Dumbbell_Deadlift": [
    "/assets/exercise-db/Stiff-Legged_Dumbbell_Deadlift/0.jpg",
    "/assets/exercise-db/Stiff-Legged_Dumbbell_Deadlift/1.jpg"
  ],
  "Stiff_Leg_Barbell_Good_Morning": [
    "/assets/exercise-db/Stiff_Leg_Barbell_Good_Morning/0.jpg",
    "/assets/exercise-db/Stiff_Leg_Barbell_Good_Morning/1.jpg"
  ],
  "Stomach_Vacuum": [
    "/assets/exercise-db/Stomach_Vacuum/0.jpg",
    "/assets/exercise-db/Stomach_Vacuum/1.jpg"
  ],
  "Straight-Arm_Dumbbell_Pullover": [
    "/assets/exercise-db/Straight-Arm_Dumbbell_Pullover/0.jpg",
    "/assets/exercise-db/Straight-Arm_Dumbbell_Pullover/1.jpg"
  ],
  "Straight-Arm_Pulldown": [
    "/assets/exercise-db/Straight-Arm_Pulldown/0.jpg",
    "/assets/exercise-db/Straight-Arm_Pulldown/1.jpg"
  ],
  "Straight_Bar_Bench_Mid_Rows": [
    "/assets/exercise-db/Straight_Bar_Bench_Mid_Rows/0.jpg",
    "/assets/exercise-db/Straight_Bar_Bench_Mid_Rows/1.jpg"
  ],
  "Straight_Raises_on_Incline_Bench": [
    "/assets/exercise-db/Straight_Raises_on_Incline_Bench/0.jpg",
    "/assets/exercise-db/Straight_Raises_on_Incline_Bench/1.jpg"
  ],
  "Stride_Jump_Crossover": [
    "/assets/exercise-db/Stride_Jump_Crossover/0.jpg",
    "/assets/exercise-db/Stride_Jump_Crossover/1.jpg"
  ],
  "Sumo_Deadlift": [
    "/assets/exercise-db/Sumo_Deadlift/0.jpg",
    "/assets/exercise-db/Sumo_Deadlift/1.jpg"
  ],
  "Sumo_Deadlift_with_Bands": [
    "/assets/exercise-db/Sumo_Deadlift_with_Bands/0.jpg",
    "/assets/exercise-db/Sumo_Deadlift_with_Bands/1.jpg"
  ],
  "Sumo_Deadlift_with_Chains": [
    "/assets/exercise-db/Sumo_Deadlift_with_Chains/0.jpg",
    "/assets/exercise-db/Sumo_Deadlift_with_Chains/1.jpg"
  ],
  "Supine_Chest_Throw": [
    "/assets/exercise-db/Supine_Chest_Throw/0.jpg",
    "/assets/exercise-db/Supine_Chest_Throw/1.jpg"
  ],
  "Supine_One-Arm_Overhead_Throw": [
    "/assets/exercise-db/Supine_One-Arm_Overhead_Throw/0.jpg",
    "/assets/exercise-db/Supine_One-Arm_Overhead_Throw/1.jpg"
  ],
  "Supine_Two-Arm_Overhead_Throw": [
    "/assets/exercise-db/Supine_Two-Arm_Overhead_Throw/0.jpg",
    "/assets/exercise-db/Supine_Two-Arm_Overhead_Throw/1.jpg"
  ],
  "Suspended_Fallout": [
    "/assets/exercise-db/Suspended_Fallout/0.jpg",
    "/assets/exercise-db/Suspended_Fallout/1.jpg"
  ],
  "Suspended_Push-Up": [
    "/assets/exercise-db/Suspended_Push-Up/0.jpg",
    "/assets/exercise-db/Suspended_Push-Up/1.jpg"
  ],
  "Suspended_Reverse_Crunch": [
    "/assets/exercise-db/Suspended_Reverse_Crunch/0.jpg",
    "/assets/exercise-db/Suspended_Reverse_Crunch/1.jpg"
  ],
  "Suspended_Row": [
    "/assets/exercise-db/Suspended_Row/0.jpg",
    "/assets/exercise-db/Suspended_Row/1.jpg"
  ],
  "Suspended_Split_Squat": [
    "/assets/exercise-db/Suspended_Split_Squat/0.jpg",
    "/assets/exercise-db/Suspended_Split_Squat/1.jpg"
  ],
  "Svend_Press": [
    "/assets/exercise-db/Svend_Press/0.jpg",
    "/assets/exercise-db/Svend_Press/1.jpg"
  ],
  "T-Bar_Row_with_Handle": [
    "/assets/exercise-db/T-Bar_Row_with_Handle/0.jpg",
    "/assets/exercise-db/T-Bar_Row_with_Handle/1.jpg"
  ],
  "Tate_Press": [
    "/assets/exercise-db/Tate_Press/0.jpg",
    "/assets/exercise-db/Tate_Press/1.jpg"
  ],
  "The_Straddle": [
    "/assets/exercise-db/The_Straddle/0.jpg",
    "/assets/exercise-db/The_Straddle/1.jpg"
  ],
  "Thigh_Abductor": [
    "/assets/exercise-db/Thigh_Abductor/0.jpg",
    "/assets/exercise-db/Thigh_Abductor/1.jpg"
  ],
  "Thigh_Adductor": [
    "/assets/exercise-db/Thigh_Adductor/0.jpg",
    "/assets/exercise-db/Thigh_Adductor/1.jpg"
  ],
  "Tire_Flip": [
    "/assets/exercise-db/Tire_Flip/0.jpg",
    "/assets/exercise-db/Tire_Flip/1.jpg"
  ],
  "Toe_Touchers": [
    "/assets/exercise-db/Toe_Touchers/0.jpg",
    "/assets/exercise-db/Toe_Touchers/1.jpg"
  ],
  "Torso_Rotation": [
    "/assets/exercise-db/Torso_Rotation/0.jpg",
    "/assets/exercise-db/Torso_Rotation/1.jpg"
  ],
  "Trail_Running_Walking": [
    "/assets/exercise-db/Trail_Running_Walking/0.jpg",
    "/assets/exercise-db/Trail_Running_Walking/1.jpg"
  ],
  "Trap_Bar_Deadlift": [
    "/assets/exercise-db/Trap_Bar_Deadlift/0.jpg",
    "/assets/exercise-db/Trap_Bar_Deadlift/1.jpg"
  ],
  "Tricep_Dumbbell_Kickback": [
    "/assets/exercise-db/Tricep_Dumbbell_Kickback/0.jpg",
    "/assets/exercise-db/Tricep_Dumbbell_Kickback/1.jpg"
  ],
  "Tricep_Side_Stretch": [
    "/assets/exercise-db/Tricep_Side_Stretch/0.jpg",
    "/assets/exercise-db/Tricep_Side_Stretch/1.jpg"
  ],
  "Triceps_Overhead_Extension_with_Rope": [
    "/assets/exercise-db/Triceps_Overhead_Extension_with_Rope/0.jpg",
    "/assets/exercise-db/Triceps_Overhead_Extension_with_Rope/1.jpg"
  ],
  "Triceps_Pushdown": [
    "/assets/exercise-db/Triceps_Pushdown/0.jpg",
    "/assets/exercise-db/Triceps_Pushdown/1.jpg"
  ],
  "Triceps_Pushdown_-_Rope_Attachment": [
    "/assets/exercise-db/Triceps_Pushdown_-_Rope_Attachment/0.jpg",
    "/assets/exercise-db/Triceps_Pushdown_-_Rope_Attachment/1.jpg"
  ],
  "Triceps_Pushdown_-_V-Bar_Attachment": [
    "/assets/exercise-db/Triceps_Pushdown_-_V-Bar_Attachment/0.jpg",
    "/assets/exercise-db/Triceps_Pushdown_-_V-Bar_Attachment/1.jpg"
  ],
  "Triceps_Stretch": [
    "/assets/exercise-db/Triceps_Stretch/0.jpg",
    "/assets/exercise-db/Triceps_Stretch/1.jpg"
  ],
  "Tuck_Crunch": [
    "/assets/exercise-db/Tuck_Crunch/0.jpg",
    "/assets/exercise-db/Tuck_Crunch/1.jpg"
  ],
  "Two-Arm_Dumbbell_Preacher_Curl": [
    "/assets/exercise-db/Two-Arm_Dumbbell_Preacher_Curl/0.jpg",
    "/assets/exercise-db/Two-Arm_Dumbbell_Preacher_Curl/1.jpg"
  ],
  "Two-Arm_Kettlebell_Clean": [
    "/assets/exercise-db/Two-Arm_Kettlebell_Clean/0.jpg",
    "/assets/exercise-db/Two-Arm_Kettlebell_Clean/1.jpg"
  ],
  "Two-Arm_Kettlebell_Jerk": [
    "/assets/exercise-db/Two-Arm_Kettlebell_Jerk/0.jpg",
    "/assets/exercise-db/Two-Arm_Kettlebell_Jerk/1.jpg"
  ],
  "Two-Arm_Kettlebell_Military_Press": [
    "/assets/exercise-db/Two-Arm_Kettlebell_Military_Press/0.jpg",
    "/assets/exercise-db/Two-Arm_Kettlebell_Military_Press/1.jpg"
  ],
  "Two-Arm_Kettlebell_Row": [
    "/assets/exercise-db/Two-Arm_Kettlebell_Row/0.jpg",
    "/assets/exercise-db/Two-Arm_Kettlebell_Row/1.jpg"
  ],
  "Underhand_Cable_Pulldowns": [
    "/assets/exercise-db/Underhand_Cable_Pulldowns/0.jpg",
    "/assets/exercise-db/Underhand_Cable_Pulldowns/1.jpg"
  ],
  "Upper_Back-Leg_Grab": [
    "/assets/exercise-db/Upper_Back-Leg_Grab/0.jpg",
    "/assets/exercise-db/Upper_Back-Leg_Grab/1.jpg"
  ],
  "Upper_Back_Stretch": [
    "/assets/exercise-db/Upper_Back_Stretch/0.jpg",
    "/assets/exercise-db/Upper_Back_Stretch/1.jpg"
  ],
  "Upright_Barbell_Row": [
    "/assets/exercise-db/Upright_Barbell_Row/0.jpg",
    "/assets/exercise-db/Upright_Barbell_Row/1.jpg"
  ],
  "Upright_Cable_Row": [
    "/assets/exercise-db/Upright_Cable_Row/0.jpg",
    "/assets/exercise-db/Upright_Cable_Row/1.jpg"
  ],
  "Upright_Row_-_With_Bands": [
    "/assets/exercise-db/Upright_Row_-_With_Bands/0.jpg",
    "/assets/exercise-db/Upright_Row_-_With_Bands/1.jpg"
  ],
  "Upward_Stretch": [
    "/assets/exercise-db/Upward_Stretch/0.jpg",
    "/assets/exercise-db/Upward_Stretch/1.jpg"
  ],
  "V-Bar_Pulldown": [
    "/assets/exercise-db/V-Bar_Pulldown/0.jpg",
    "/assets/exercise-db/V-Bar_Pulldown/1.jpg"
  ],
  "V-Bar_Pullup": [
    "/assets/exercise-db/V-Bar_Pullup/0.jpg",
    "/assets/exercise-db/V-Bar_Pullup/1.jpg"
  ],
  "Vertical_Swing": [
    "/assets/exercise-db/Vertical_Swing/0.jpg",
    "/assets/exercise-db/Vertical_Swing/1.jpg"
  ],
  "Walking_Treadmill": [
    "/assets/exercise-db/Walking_Treadmill/0.jpg",
    "/assets/exercise-db/Walking_Treadmill/1.jpg"
  ],
  "Weighted_Ball_Hyperextension": [
    "/assets/exercise-db/Weighted_Ball_Hyperextension/0.jpg",
    "/assets/exercise-db/Weighted_Ball_Hyperextension/1.jpg"
  ],
  "Weighted_Ball_Side_Bend": [
    "/assets/exercise-db/Weighted_Ball_Side_Bend/0.jpg",
    "/assets/exercise-db/Weighted_Ball_Side_Bend/1.jpg"
  ],
  "Weighted_Bench_Dip": [
    "/assets/exercise-db/Weighted_Bench_Dip/0.jpg",
    "/assets/exercise-db/Weighted_Bench_Dip/1.jpg"
  ],
  "Weighted_Crunches": [
    "/assets/exercise-db/Weighted_Crunches/0.jpg",
    "/assets/exercise-db/Weighted_Crunches/1.jpg"
  ],
  "Weighted_Jump_Squat": [
    "/assets/exercise-db/Weighted_Jump_Squat/0.jpg",
    "/assets/exercise-db/Weighted_Jump_Squat/1.jpg"
  ],
  "Weighted_Pull_Ups": [
    "/assets/exercise-db/Weighted_Pull_Ups/0.jpg",
    "/assets/exercise-db/Weighted_Pull_Ups/1.jpg"
  ],
  "Weighted_Sissy_Squat": [
    "/assets/exercise-db/Weighted_Sissy_Squat/0.jpg",
    "/assets/exercise-db/Weighted_Sissy_Squat/1.jpg"
  ],
  "Weighted_Sit-Ups_-_With_Bands": [
    "/assets/exercise-db/Weighted_Sit-Ups_-_With_Bands/0.jpg",
    "/assets/exercise-db/Weighted_Sit-Ups_-_With_Bands/1.jpg"
  ],
  "Weighted_Squat": [
    "/assets/exercise-db/Weighted_Squat/0.jpg",
    "/assets/exercise-db/Weighted_Squat/1.jpg"
  ],
  "Wide-Grip_Barbell_Bench_Press": [
    "/assets/exercise-db/Wide-Grip_Barbell_Bench_Press/0.jpg",
    "/assets/exercise-db/Wide-Grip_Barbell_Bench_Press/1.jpg"
  ],
  "Wide-Grip_Decline_Barbell_Bench_Press": [
    "/assets/exercise-db/Wide-Grip_Decline_Barbell_Bench_Press/0.jpg",
    "/assets/exercise-db/Wide-Grip_Decline_Barbell_Bench_Press/1.jpg"
  ],
  "Wide-Grip_Decline_Barbell_Pullover": [
    "/assets/exercise-db/Wide-Grip_Decline_Barbell_Pullover/0.jpg",
    "/assets/exercise-db/Wide-Grip_Decline_Barbell_Pullover/1.jpg"
  ],
  "Wide-Grip_Lat_Pulldown": [
    "/assets/exercise-db/Wide-Grip_Lat_Pulldown/0.jpg",
    "/assets/exercise-db/Wide-Grip_Lat_Pulldown/1.jpg"
  ],
  "Wide-Grip_Pulldown_Behind_The_Neck": [
    "/assets/exercise-db/Wide-Grip_Pulldown_Behind_The_Neck/0.jpg",
    "/assets/exercise-db/Wide-Grip_Pulldown_Behind_The_Neck/1.jpg"
  ],
  "Wide-Grip_Rear_Pull-Up": [
    "/assets/exercise-db/Wide-Grip_Rear_Pull-Up/0.jpg",
    "/assets/exercise-db/Wide-Grip_Rear_Pull-Up/1.jpg"
  ],
  "Wide-Grip_Standing_Barbell_Curl": [
    "/assets/exercise-db/Wide-Grip_Standing_Barbell_Curl/0.jpg",
    "/assets/exercise-db/Wide-Grip_Standing_Barbell_Curl/1.jpg"
  ],
  "Wide_Stance_Barbell_Squat": [
    "/assets/exercise-db/Wide_Stance_Barbell_Squat/0.jpg",
    "/assets/exercise-db/Wide_Stance_Barbell_Squat/1.jpg"
  ],
  "Wide_Stance_Stiff_Legs": [
    "/assets/exercise-db/Wide_Stance_Stiff_Legs/0.jpg",
    "/assets/exercise-db/Wide_Stance_Stiff_Legs/1.jpg"
  ],
  "Wind_Sprints": [
    "/assets/exercise-db/Wind_Sprints/0.jpg",
    "/assets/exercise-db/Wind_Sprints/1.jpg"
  ],
  "Windmills": [
    "/assets/exercise-db/Windmills/0.jpg",
    "/assets/exercise-db/Windmills/1.jpg"
  ],
  "Worlds_Greatest_Stretch": [
    "/assets/exercise-db/Worlds_Greatest_Stretch/0.jpg",
    "/assets/exercise-db/Worlds_Greatest_Stretch/1.jpg"
  ],
  "Wrist_Circles": [
    "/assets/exercise-db/Wrist_Circles/0.jpg",
    "/assets/exercise-db/Wrist_Circles/1.jpg"
  ],
  "Wrist_Roller": [
    "/assets/exercise-db/Wrist_Roller/0.jpg",
    "/assets/exercise-db/Wrist_Roller/1.jpg"
  ],
  "Wrist_Rotations_with_Straight_Bar": [
    "/assets/exercise-db/Wrist_Rotations_with_Straight_Bar/0.jpg",
    "/assets/exercise-db/Wrist_Rotations_with_Straight_Bar/1.jpg"
  ],
  "Yoke_Walk": [
    "/assets/exercise-db/Yoke_Walk/0.jpg",
    "/assets/exercise-db/Yoke_Walk/1.jpg"
  ],
  "Zercher_Squats": [
    "/assets/exercise-db/Zercher_Squats/0.jpg",
    "/assets/exercise-db/Zercher_Squats/1.jpg"
  ],
  "Zottman_Curl": [
    "/assets/exercise-db/Zottman_Curl/0.jpg",
    "/assets/exercise-db/Zottman_Curl/1.jpg"
  ],
  "Zottman_Preacher_Curl": [
    "/assets/exercise-db/Zottman_Preacher_Curl/0.jpg",
    "/assets/exercise-db/Zottman_Preacher_Curl/1.jpg"
  ],
  "ab-wheel": [
    "/assets/exercise-db/ab-wheel/0.jpg",
    "/assets/exercise-db/ab-wheel/1.jpg"
  ],
  "abductor-machine": [
    "/assets/exercise-db/abductor-machine/0.jpg",
    "/assets/exercise-db/abductor-machine/1.jpg"
  ],
  "adductor-machine": [
    "/assets/exercise-db/adductor-machine/0.jpg",
    "/assets/exercise-db/adductor-machine/1.jpg"
  ],
  "archer-push-up": [
    "/assets/exercise-db/archer-push-up/0.jpg",
    "/assets/exercise-db/archer-push-up/1.jpg"
  ],
  "arnold-press": [
    "/assets/exercise-db/arnold-press/0.jpg",
    "/assets/exercise-db/arnold-press/1.jpg"
  ],
  "assault-bike": [
    "/assets/exercise-db/assault-bike/0.jpg",
    "/assets/exercise-db/assault-bike/1.jpg"
  ],
  "band-chest-press": [
    "/assets/exercise-db/band-chest-press/0.jpg",
    "/assets/exercise-db/band-chest-press/1.jpg"
  ],
  "band-curl": [
    "/assets/exercise-db/band-curl/0.jpg",
    "/assets/exercise-db/band-curl/1.jpg"
  ],
  "band-glute-kickback": [
    "/assets/exercise-db/band-glute-kickback/0.jpg",
    "/assets/exercise-db/band-glute-kickback/1.jpg"
  ],
  "band-hip-thrust": [
    "/assets/exercise-db/band-hip-thrust/0.jpg",
    "/assets/exercise-db/band-hip-thrust/1.jpg"
  ],
  "band-lateral-walk": [
    "/assets/exercise-db/band-lateral-walk/0.jpg",
    "/assets/exercise-db/band-lateral-walk/1.jpg"
  ],
  "band-leg-curl": [
    "/assets/exercise-db/band-leg-curl/0.jpg",
    "/assets/exercise-db/band-leg-curl/1.jpg"
  ],
  "band-pull-apart": [
    "/assets/exercise-db/band-pull-apart/0.jpg",
    "/assets/exercise-db/band-pull-apart/1.jpg"
  ],
  "band-pulldown": [
    "/assets/exercise-db/band-pulldown/0.jpg",
    "/assets/exercise-db/band-pulldown/1.jpg"
  ],
  "band-squat": [
    "/assets/exercise-db/band-squat/0.jpg",
    "/assets/exercise-db/band-squat/1.jpg"
  ],
  "band-triceps-extension": [
    "/assets/exercise-db/band-triceps-extension/0.jpg",
    "/assets/exercise-db/band-triceps-extension/1.jpg"
  ],
  "barbell-calf-raise": [
    "/assets/exercise-db/barbell-calf-raise/0.jpg",
    "/assets/exercise-db/barbell-calf-raise/1.jpg"
  ],
  "barbell-curl": [
    "/assets/exercise-db/barbell-curl/0.jpg",
    "/assets/exercise-db/barbell-curl/1.jpg"
  ],
  "barbell-lunge": [
    "/assets/exercise-db/barbell-lunge/0.jpg",
    "/assets/exercise-db/barbell-lunge/1.jpg"
  ],
  "barbell-row": [
    "/assets/exercise-db/barbell-row/0.jpg",
    "/assets/exercise-db/barbell-row/1.jpg"
  ],
  "barbell-shrug": [
    "/assets/exercise-db/barbell-shrug/0.jpg",
    "/assets/exercise-db/barbell-shrug/1.jpg"
  ],
  "barbell-step-up": [
    "/assets/exercise-db/barbell-step-up/0.jpg",
    "/assets/exercise-db/barbell-step-up/1.jpg"
  ],
  "battle-ropes": [
    "/assets/exercise-db/battle-ropes/0.jpg",
    "/assets/exercise-db/battle-ropes/1.jpg"
  ],
  "bear-crawl": [
    "/assets/exercise-db/bear-crawl/0.jpg",
    "/assets/exercise-db/bear-crawl/1.jpg"
  ],
  "bench-dip": [
    "/assets/exercise-db/bench-dip/0.jpg",
    "/assets/exercise-db/bench-dip/1.jpg"
  ],
  "bench-press": [
    "/assets/exercise-db/bench-press/0.jpg",
    "/assets/exercise-db/bench-press/1.jpg"
  ],
  "bicep-curl": [
    "/assets/exercise-db/bicep-curl/0.jpg",
    "/assets/exercise-db/bicep-curl/1.jpg"
  ],
  "bicycle-crunch": [
    "/assets/exercise-db/bicycle-crunch/0.jpg",
    "/assets/exercise-db/bicycle-crunch/1.jpg"
  ],
  "bird-dog": [
    "/assets/exercise-db/bird-dog/0.jpg",
    "/assets/exercise-db/bird-dog/1.jpg"
  ],
  "bodyweight-squat": [
    "/assets/exercise-db/bodyweight-squat/0.jpg",
    "/assets/exercise-db/bodyweight-squat/1.jpg"
  ],
  "box-jump": [
    "/assets/exercise-db/box-jump/0.jpg",
    "/assets/exercise-db/box-jump/1.jpg"
  ],
  "box-squat": [
    "/assets/exercise-db/box-squat/0.jpg",
    "/assets/exercise-db/box-squat/1.jpg"
  ],
  "burpee": [
    "/assets/exercise-db/burpee/0.jpg",
    "/assets/exercise-db/burpee/1.jpg"
  ],
  "cable-crossover": [
    "/assets/exercise-db/cable-crossover/0.jpg",
    "/assets/exercise-db/cable-crossover/1.jpg"
  ],
  "cable-crunch": [
    "/assets/exercise-db/cable-crunch/0.jpg",
    "/assets/exercise-db/cable-crunch/1.jpg"
  ],
  "cable-curl": [
    "/assets/exercise-db/cable-curl/0.jpg",
    "/assets/exercise-db/cable-curl/1.jpg"
  ],
  "cable-fly": [
    "/assets/exercise-db/cable-fly/0.jpg",
    "/assets/exercise-db/cable-fly/1.jpg"
  ],
  "cable-kickback": [
    "/assets/exercise-db/cable-kickback/0.jpg",
    "/assets/exercise-db/cable-kickback/1.jpg"
  ],
  "cable-lateral-raise": [
    "/assets/exercise-db/cable-lateral-raise/0.jpg",
    "/assets/exercise-db/cable-lateral-raise/1.jpg"
  ],
  "calf-raise": [
    "/assets/exercise-db/calf-raise/0.jpg",
    "/assets/exercise-db/calf-raise/1.jpg"
  ],
  "captains-chair-raise": [
    "/assets/exercise-db/captains-chair-raise/0.jpg",
    "/assets/exercise-db/captains-chair-raise/1.jpg"
  ],
  "cat-cow": [
    "/assets/exercise-db/cat-cow/0.jpg",
    "/assets/exercise-db/cat-cow/1.jpg"
  ],
  "chest-dip": [
    "/assets/exercise-db/chest-dip/0.jpg",
    "/assets/exercise-db/chest-dip/1.jpg"
  ],
  "chest-press-machine": [
    "/assets/exercise-db/chest-press-machine/0.jpg",
    "/assets/exercise-db/chest-press-machine/1.jpg"
  ],
  "chest-supported-row": [
    "/assets/exercise-db/chest-supported-row/0.jpg",
    "/assets/exercise-db/chest-supported-row/1.jpg"
  ],
  "chin-up": [
    "/assets/exercise-db/chin-up/0.jpg",
    "/assets/exercise-db/chin-up/1.jpg"
  ],
  "clean-and-press": [
    "/assets/exercise-db/clean-and-press/0.jpg",
    "/assets/exercise-db/clean-and-press/1.jpg"
  ],
  "close-grip-bench-press": [
    "/assets/exercise-db/close-grip-bench-press/0.jpg",
    "/assets/exercise-db/close-grip-bench-press/1.jpg"
  ],
  "close-grip-pulldown": [
    "/assets/exercise-db/close-grip-pulldown/0.jpg",
    "/assets/exercise-db/close-grip-pulldown/1.jpg"
  ],
  "close-grip-push-up": [
    "/assets/exercise-db/close-grip-push-up/0.jpg",
    "/assets/exercise-db/close-grip-push-up/1.jpg"
  ],
  "concentration-curl": [
    "/assets/exercise-db/concentration-curl/0.jpg",
    "/assets/exercise-db/concentration-curl/1.jpg"
  ],
  "cossack-squat": [
    "/assets/exercise-db/cossack-squat/0.jpg",
    "/assets/exercise-db/cossack-squat/1.jpg"
  ],
  "couch-stretch": [
    "/assets/exercise-db/couch-stretch/0.jpg",
    "/assets/exercise-db/couch-stretch/1.jpg"
  ],
  "db-bulgarian-split-squat": [
    "/assets/exercise-db/db-bulgarian-split-squat/0.jpg",
    "/assets/exercise-db/db-bulgarian-split-squat/1.jpg"
  ],
  "db-calf-raise": [
    "/assets/exercise-db/db-calf-raise/0.jpg",
    "/assets/exercise-db/db-calf-raise/1.jpg"
  ],
  "db-fly": [
    "/assets/exercise-db/db-fly/0.jpg",
    "/assets/exercise-db/db-fly/1.jpg"
  ],
  "db-hip-thrust": [
    "/assets/exercise-db/db-hip-thrust/0.jpg",
    "/assets/exercise-db/db-hip-thrust/1.jpg"
  ],
  "db-incline-press": [
    "/assets/exercise-db/db-incline-press/0.jpg",
    "/assets/exercise-db/db-incline-press/1.jpg"
  ],
  "db-pullover": [
    "/assets/exercise-db/db-pullover/0.jpg",
    "/assets/exercise-db/db-pullover/1.jpg"
  ],
  "db-romanian-deadlift": [
    "/assets/exercise-db/db-romanian-deadlift/0.jpg",
    "/assets/exercise-db/db-romanian-deadlift/1.jpg"
  ],
  "db-shoulder-press": [
    "/assets/exercise-db/db-shoulder-press/0.jpg",
    "/assets/exercise-db/db-shoulder-press/1.jpg"
  ],
  "db-shrug": [
    "/assets/exercise-db/db-shrug/0.jpg",
    "/assets/exercise-db/db-shrug/1.jpg"
  ],
  "db-step-up": [
    "/assets/exercise-db/db-step-up/0.jpg",
    "/assets/exercise-db/db-step-up/1.jpg"
  ],
  "db-sumo-squat": [
    "/assets/exercise-db/db-sumo-squat/0.jpg",
    "/assets/exercise-db/db-sumo-squat/1.jpg"
  ],
  "db-walking-lunge": [
    "/assets/exercise-db/db-walking-lunge/0.jpg",
    "/assets/exercise-db/db-walking-lunge/1.jpg"
  ],
  "dead-bug": [
    "/assets/exercise-db/dead-bug/0.jpg",
    "/assets/exercise-db/dead-bug/1.jpg"
  ],
  "dead-hang": [
    "/assets/exercise-db/dead-hang/0.jpg",
    "/assets/exercise-db/dead-hang/1.jpg"
  ],
  "deadlift": [
    "/assets/exercise-db/deadlift/0.jpg",
    "/assets/exercise-db/deadlift/1.jpg"
  ],
  "decline-bench-press": [
    "/assets/exercise-db/decline-bench-press/0.jpg",
    "/assets/exercise-db/decline-bench-press/1.jpg"
  ],
  "decline-push-up": [
    "/assets/exercise-db/decline-push-up/0.jpg",
    "/assets/exercise-db/decline-push-up/1.jpg"
  ],
  "diamond-push-up": [
    "/assets/exercise-db/diamond-push-up/0.jpg",
    "/assets/exercise-db/diamond-push-up/1.jpg"
  ],
  "dragon-flag": [
    "/assets/exercise-db/dragon-flag/0.jpg",
    "/assets/exercise-db/dragon-flag/1.jpg"
  ],
  "dumbbell-press": [
    "/assets/exercise-db/dumbbell-press/0.jpg",
    "/assets/exercise-db/dumbbell-press/1.jpg"
  ],
  "elliptical": [
    "/assets/exercise-db/elliptical/0.jpg",
    "/assets/exercise-db/elliptical/1.jpg"
  ],
  "ez-bar-curl": [
    "/assets/exercise-db/ez-bar-curl/0.jpg",
    "/assets/exercise-db/ez-bar-curl/1.jpg"
  ],
  "face-pull": [
    "/assets/exercise-db/face-pull/0.jpg",
    "/assets/exercise-db/face-pull/1.jpg"
  ],
  "farmers-carry": [
    "/assets/exercise-db/farmers-carry/0.jpg",
    "/assets/exercise-db/farmers-carry/1.jpg"
  ],
  "foam-roll-quads": [
    "/assets/exercise-db/foam-roll-quads/0.jpg",
    "/assets/exercise-db/foam-roll-quads/1.jpg"
  ],
  "frog-pump": [
    "/assets/exercise-db/frog-pump/0.jpg",
    "/assets/exercise-db/frog-pump/1.jpg"
  ],
  "front-raise": [
    "/assets/exercise-db/front-raise/0.jpg",
    "/assets/exercise-db/front-raise/1.jpg"
  ],
  "front-squat": [
    "/assets/exercise-db/front-squat/0.jpg",
    "/assets/exercise-db/front-squat/1.jpg"
  ],
  "glute-bridge": [
    "/assets/exercise-db/glute-bridge/0.jpg",
    "/assets/exercise-db/glute-bridge/1.jpg"
  ],
  "glute-machine": [
    "/assets/exercise-db/glute-machine/0.jpg",
    "/assets/exercise-db/glute-machine/1.jpg"
  ],
  "goblet-squat": [
    "/assets/exercise-db/goblet-squat/0.jpg",
    "/assets/exercise-db/goblet-squat/1.jpg"
  ],
  "good-morning": [
    "/assets/exercise-db/good-morning/0.jpg",
    "/assets/exercise-db/good-morning/1.jpg"
  ],
  "hack-squat": [
    "/assets/exercise-db/hack-squat/0.jpg",
    "/assets/exercise-db/hack-squat/1.jpg"
  ],
  "hammer-curl": [
    "/assets/exercise-db/hammer-curl/0.jpg",
    "/assets/exercise-db/hammer-curl/1.jpg"
  ],
  "handstand-hold": [
    "/assets/exercise-db/handstand-hold/0.jpg",
    "/assets/exercise-db/handstand-hold/1.jpg"
  ],
  "hanging-leg-raise": [
    "/assets/exercise-db/hanging-leg-raise/0.jpg",
    "/assets/exercise-db/hanging-leg-raise/1.jpg"
  ],
  "high-knees": [
    "/assets/exercise-db/high-knees/0.jpg",
    "/assets/exercise-db/high-knees/1.jpg"
  ],
  "hip-flexor-stretch": [
    "/assets/exercise-db/hip-flexor-stretch/0.jpg",
    "/assets/exercise-db/hip-flexor-stretch/1.jpg"
  ],
  "hip-thrust": [
    "/assets/exercise-db/hip-thrust/0.jpg",
    "/assets/exercise-db/hip-thrust/1.jpg"
  ],
  "hollow-hold": [
    "/assets/exercise-db/hollow-hold/0.jpg",
    "/assets/exercise-db/hollow-hold/1.jpg"
  ],
  "hyperextension": [
    "/assets/exercise-db/hyperextension/0.jpg",
    "/assets/exercise-db/hyperextension/1.jpg"
  ],
  "incline-bench-press": [
    "/assets/exercise-db/incline-bench-press/0.jpg",
    "/assets/exercise-db/incline-bench-press/1.jpg"
  ],
  "incline-db-curl": [
    "/assets/exercise-db/incline-db-curl/0.jpg",
    "/assets/exercise-db/incline-db-curl/1.jpg"
  ],
  "inverted-row": [
    "/assets/exercise-db/inverted-row/0.jpg",
    "/assets/exercise-db/inverted-row/1.jpg"
  ],
  "jump-rope": [
    "/assets/exercise-db/jump-rope/0.jpg",
    "/assets/exercise-db/jump-rope/1.jpg"
  ],
  "jump-squat": [
    "/assets/exercise-db/jump-squat/0.jpg",
    "/assets/exercise-db/jump-squat/1.jpg"
  ],
  "jumping-jack": [
    "/assets/exercise-db/jumping-jack/0.jpg",
    "/assets/exercise-db/jumping-jack/1.jpg"
  ],
  "kb-clean": [
    "/assets/exercise-db/kb-clean/0.jpg",
    "/assets/exercise-db/kb-clean/1.jpg"
  ],
  "kb-deadlift": [
    "/assets/exercise-db/kb-deadlift/0.jpg",
    "/assets/exercise-db/kb-deadlift/1.jpg"
  ],
  "kb-front-rack-squat": [
    "/assets/exercise-db/kb-front-rack-squat/0.jpg",
    "/assets/exercise-db/kb-front-rack-squat/1.jpg"
  ],
  "kb-lunge": [
    "/assets/exercise-db/kb-lunge/0.jpg",
    "/assets/exercise-db/kb-lunge/1.jpg"
  ],
  "kb-snatch": [
    "/assets/exercise-db/kb-snatch/0.jpg",
    "/assets/exercise-db/kb-snatch/1.jpg"
  ],
  "kb-turkish-get-up": [
    "/assets/exercise-db/kb-turkish-get-up/0.jpg",
    "/assets/exercise-db/kb-turkish-get-up/1.jpg"
  ],
  "kettlebell-swing": [
    "/assets/exercise-db/kettlebell-swing/0.jpg",
    "/assets/exercise-db/kettlebell-swing/1.jpg"
  ],
  "landmine-press": [
    "/assets/exercise-db/landmine-press/0.jpg",
    "/assets/exercise-db/landmine-press/1.jpg"
  ],
  "lat-pulldown": [
    "/assets/exercise-db/lat-pulldown/0.jpg",
    "/assets/exercise-db/lat-pulldown/1.jpg"
  ],
  "lateral-raise": [
    "/assets/exercise-db/lateral-raise/0.jpg",
    "/assets/exercise-db/lateral-raise/1.jpg"
  ],
  "leg-curl": [
    "/assets/exercise-db/leg-curl/0.jpg",
    "/assets/exercise-db/leg-curl/1.jpg"
  ],
  "leg-extension": [
    "/assets/exercise-db/leg-extension/0.jpg",
    "/assets/exercise-db/leg-extension/1.jpg"
  ],
  "leg-press": [
    "/assets/exercise-db/leg-press/0.jpg",
    "/assets/exercise-db/leg-press/1.jpg"
  ],
  "lunge": [
    "/assets/exercise-db/lunge/0.jpg",
    "/assets/exercise-db/lunge/1.jpg"
  ],
  "machine-row": [
    "/assets/exercise-db/machine-row/0.jpg",
    "/assets/exercise-db/machine-row/1.jpg"
  ],
  "med-ball-slam": [
    "/assets/exercise-db/med-ball-slam/0.jpg",
    "/assets/exercise-db/med-ball-slam/1.jpg"
  ],
  "med-ball-twist": [
    "/assets/exercise-db/med-ball-twist/0.jpg",
    "/assets/exercise-db/med-ball-twist/1.jpg"
  ],
  "mountain-climber": [
    "/assets/exercise-db/mountain-climber/0.jpg",
    "/assets/exercise-db/mountain-climber/1.jpg"
  ],
  "neutral-grip-pull-up": [
    "/assets/exercise-db/neutral-grip-pull-up/0.jpg",
    "/assets/exercise-db/neutral-grip-pull-up/1.jpg"
  ],
  "one-arm-db-row": [
    "/assets/exercise-db/one-arm-db-row/0.jpg",
    "/assets/exercise-db/one-arm-db-row/1.jpg"
  ],
  "overhead-press": [
    "/assets/exercise-db/overhead-press/0.jpg",
    "/assets/exercise-db/overhead-press/1.jpg"
  ],
  "overhead-triceps-extension": [
    "/assets/exercise-db/overhead-triceps-extension/0.jpg",
    "/assets/exercise-db/overhead-triceps-extension/1.jpg"
  ],
  "pallof-press": [
    "/assets/exercise-db/pallof-press/0.jpg",
    "/assets/exercise-db/pallof-press/1.jpg"
  ],
  "pause-squat": [
    "/assets/exercise-db/pause-squat/0.jpg",
    "/assets/exercise-db/pause-squat/1.jpg"
  ],
  "pec-deck": [
    "/assets/exercise-db/pec-deck/0.jpg",
    "/assets/exercise-db/pec-deck/1.jpg"
  ],
  "pendlay-row": [
    "/assets/exercise-db/pendlay-row/0.jpg",
    "/assets/exercise-db/pendlay-row/1.jpg"
  ],
  "pike-push-up": [
    "/assets/exercise-db/pike-push-up/0.jpg",
    "/assets/exercise-db/pike-push-up/1.jpg"
  ],
  "pistol-squat": [
    "/assets/exercise-db/pistol-squat/0.jpg",
    "/assets/exercise-db/pistol-squat/1.jpg"
  ],
  "plank": [
    "/assets/exercise-db/plank/0.jpg",
    "/assets/exercise-db/plank/1.jpg"
  ],
  "plank-shoulder-tap": [
    "/assets/exercise-db/plank-shoulder-tap/0.jpg",
    "/assets/exercise-db/plank-shoulder-tap/1.jpg"
  ],
  "preacher-curl": [
    "/assets/exercise-db/preacher-curl/0.jpg",
    "/assets/exercise-db/preacher-curl/1.jpg"
  ],
  "pull-up": [
    "/assets/exercise-db/pull-up/0.jpg",
    "/assets/exercise-db/pull-up/1.jpg"
  ],
  "push-up": [
    "/assets/exercise-db/push-up/0.jpg",
    "/assets/exercise-db/push-up/1.jpg"
  ],
  "rack-pull": [
    "/assets/exercise-db/rack-pull/0.jpg",
    "/assets/exercise-db/rack-pull/1.jpg"
  ],
  "rear-delt-fly": [
    "/assets/exercise-db/rear-delt-fly/0.jpg",
    "/assets/exercise-db/rear-delt-fly/1.jpg"
  ],
  "reverse-lunge": [
    "/assets/exercise-db/reverse-lunge/0.jpg",
    "/assets/exercise-db/reverse-lunge/1.jpg"
  ],
  "romanian-deadlift": [
    "/assets/exercise-db/romanian-deadlift/0.jpg",
    "/assets/exercise-db/romanian-deadlift/1.jpg"
  ],
  "rope-pushdown": [
    "/assets/exercise-db/rope-pushdown/0.jpg",
    "/assets/exercise-db/rope-pushdown/1.jpg"
  ],
  "rowing-machine": [
    "/assets/exercise-db/rowing-machine/0.jpg",
    "/assets/exercise-db/rowing-machine/1.jpg"
  ],
  "russian-twist": [
    "/assets/exercise-db/russian-twist/0.jpg",
    "/assets/exercise-db/russian-twist/1.jpg"
  ],
  "seated-cable-row": [
    "/assets/exercise-db/seated-cable-row/0.jpg",
    "/assets/exercise-db/seated-cable-row/1.jpg"
  ],
  "seated-calf-raise": [
    "/assets/exercise-db/seated-calf-raise/0.jpg",
    "/assets/exercise-db/seated-calf-raise/1.jpg"
  ],
  "shoulder-press-machine": [
    "/assets/exercise-db/shoulder-press-machine/0.jpg",
    "/assets/exercise-db/shoulder-press-machine/1.jpg"
  ],
  "side-plank": [
    "/assets/exercise-db/side-plank/0.jpg",
    "/assets/exercise-db/side-plank/1.jpg"
  ],
  "single-leg-glute-bridge": [
    "/assets/exercise-db/single-leg-glute-bridge/0.jpg",
    "/assets/exercise-db/single-leg-glute-bridge/1.jpg"
  ],
  "sit-up": [
    "/assets/exercise-db/sit-up/0.jpg",
    "/assets/exercise-db/sit-up/1.jpg"
  ],
  "ski-erg": [
    "/assets/exercise-db/ski-erg/0.jpg",
    "/assets/exercise-db/ski-erg/1.jpg"
  ],
  "skullcrusher": [
    "/assets/exercise-db/skullcrusher/0.jpg",
    "/assets/exercise-db/skullcrusher/1.jpg"
  ],
  "sled-push": [
    "/assets/exercise-db/sled-push/0.jpg",
    "/assets/exercise-db/sled-push/1.jpg"
  ],
  "smith-squat": [
    "/assets/exercise-db/smith-squat/0.jpg",
    "/assets/exercise-db/smith-squat/1.jpg"
  ],
  "squat": [
    "/assets/exercise-db/squat/0.jpg",
    "/assets/exercise-db/squat/1.jpg"
  ],
  "stair-climber": [
    "/assets/exercise-db/stair-climber/0.jpg",
    "/assets/exercise-db/stair-climber/1.jpg"
  ],
  "straight-arm-pulldown": [
    "/assets/exercise-db/straight-arm-pulldown/0.jpg",
    "/assets/exercise-db/straight-arm-pulldown/1.jpg"
  ],
  "sumo-deadlift": [
    "/assets/exercise-db/sumo-deadlift/0.jpg",
    "/assets/exercise-db/sumo-deadlift/1.jpg"
  ],
  "superman": [
    "/assets/exercise-db/superman/0.jpg",
    "/assets/exercise-db/superman/1.jpg"
  ],
  "t-bar-row": [
    "/assets/exercise-db/t-bar-row/0.jpg",
    "/assets/exercise-db/t-bar-row/1.jpg"
  ],
  "thoracic-rotation": [
    "/assets/exercise-db/thoracic-rotation/0.jpg",
    "/assets/exercise-db/thoracic-rotation/1.jpg"
  ],
  "thruster": [
    "/assets/exercise-db/thruster/0.jpg",
    "/assets/exercise-db/thruster/1.jpg"
  ],
  "toes-to-bar": [
    "/assets/exercise-db/toes-to-bar/0.jpg",
    "/assets/exercise-db/toes-to-bar/1.jpg"
  ],
  "treadmill-sprint": [
    "/assets/exercise-db/treadmill-sprint/0.jpg",
    "/assets/exercise-db/treadmill-sprint/1.jpg"
  ],
  "tricep-dip": [
    "/assets/exercise-db/tricep-dip/0.jpg",
    "/assets/exercise-db/tricep-dip/1.jpg"
  ],
  "triceps-pushdown": [
    "/assets/exercise-db/triceps-pushdown/0.jpg",
    "/assets/exercise-db/triceps-pushdown/1.jpg"
  ],
  "trx-fallout": [
    "/assets/exercise-db/trx-fallout/0.jpg",
    "/assets/exercise-db/trx-fallout/1.jpg"
  ],
  "trx-pistol": [
    "/assets/exercise-db/trx-pistol/0.jpg",
    "/assets/exercise-db/trx-pistol/1.jpg"
  ],
  "trx-push-up": [
    "/assets/exercise-db/trx-push-up/0.jpg",
    "/assets/exercise-db/trx-push-up/1.jpg"
  ],
  "trx-row": [
    "/assets/exercise-db/trx-row/0.jpg",
    "/assets/exercise-db/trx-row/1.jpg"
  ],
  "upright-row": [
    "/assets/exercise-db/upright-row/0.jpg",
    "/assets/exercise-db/upright-row/1.jpg"
  ],
  "v-up": [
    "/assets/exercise-db/v-up/0.jpg",
    "/assets/exercise-db/v-up/1.jpg"
  ],
  "wall-ball": [
    "/assets/exercise-db/wall-ball/0.jpg",
    "/assets/exercise-db/wall-ball/1.jpg"
  ],
  "wall-sit": [
    "/assets/exercise-db/wall-sit/0.jpg",
    "/assets/exercise-db/wall-sit/1.jpg"
  ],
  "wide-grip-pulldown": [
    "/assets/exercise-db/wide-grip-pulldown/0.jpg",
    "/assets/exercise-db/wide-grip-pulldown/1.jpg"
  ],
  "wide-push-up": [
    "/assets/exercise-db/wide-push-up/0.jpg",
    "/assets/exercise-db/wide-push-up/1.jpg"
  ],
  "worlds-greatest-stretch": [
    "/assets/exercise-db/worlds-greatest-stretch/0.jpg",
    "/assets/exercise-db/worlds-greatest-stretch/1.jpg"
  ],
  "wrist-curl": [
    "/assets/exercise-db/wrist-curl/0.jpg",
    "/assets/exercise-db/wrist-curl/1.jpg"
  ],
  "zercher-squat": [
    "/assets/exercise-db/zercher-squat/0.jpg",
    "/assets/exercise-db/zercher-squat/1.jpg"
  ]
};

export function getExerciseMedia(slug: string): ExerciseMediaResult {
  if (!slug) return { type: "fallback", isAvailable: false };
  const cleanSlug = slug.toLowerCase().trim();

  if (VIDEO_MAP[cleanSlug]) {
    return {
      type: "video",
      videoUrl: VIDEO_MAP[cleanSlug],
      posterUrl: EXERCISE_DB_FRAMES[cleanSlug]?.[0],
      isAvailable: true,
    };
  }

  if (EXERCISE_DB_FRAMES[cleanSlug] && EXERCISE_DB_FRAMES[cleanSlug].length > 0) {
    const frames = EXERCISE_DB_FRAMES[cleanSlug];
    return {
      type: "frames",
      frames: frames,
      posterUrl: frames[0],
      isAvailable: true,
    };
  }

  return {
    type: "fallback",
    isAvailable: false,
  };
}

// Backward-compatibility eksportai esamiems GYMS.LIFE komponentams
export function exerciseVideo(slug: string): string | null {
  const media = getExerciseMedia(slug);
  if (media.type === "video" && media.videoUrl) return media.videoUrl;
  return null;
}

export function exerciseVideoPoster(slug: string): string | null {
  const media = getExerciseMedia(slug);
  return media.posterUrl || null;
}

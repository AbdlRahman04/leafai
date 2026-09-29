import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D, Input
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from tensorflow.keras.optimizers import Adam
import json
import os
import numpy as np
from pathlib import Path

print("="*50)
print("TRAINING PLANT DISEASE MODEL")
print("="*50)

BACKEND_DIR = Path(__file__).resolve().parent
DATASET_DIR = BACKEND_DIR / "dataset" / "PlantVillage" / "color"
MODEL_DIR = BACKEND_DIR / "models"
IMG_SIZE = (128, 128)
BATCH_SIZE = 16
EPOCHS = 10

MODEL_DIR.mkdir(parents=True, exist_ok=True)

if not os.path.exists(DATASET_DIR):
    print(f"ERROR: Dataset not found at {DATASET_DIR}")
    exit(1)

class_folders = [f for f in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, f))]
print(f"Found {len(class_folders)} disease classes")

if len(class_folders) < 2:
    print("ERROR: Need at least 2 classes for training")
    exit(1)

train_datagen = ImageDataGenerator(
    preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input,
    validation_split=0.2,
    rotation_range=20,
    width_shift_range=0.15,
    height_shift_range=0.15,
    zoom_range=0.15,
    horizontal_flip=True,
    fill_mode="nearest"
)

val_datagen = ImageDataGenerator(
    preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input,
    validation_split=0.2
)

train_generator = train_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    subset="training",
    shuffle=True
)

val_generator = val_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    subset="validation",
    shuffle=False
)

print(f"\nTraining samples: {train_generator.samples}")
print(f"Validation samples: {val_generator.samples}")
print(f"Number of classes: {train_generator.num_classes}")

base_model = MobileNetV2(
    weights="imagenet",
    include_top=False,
    input_tensor=Input(shape=(128, 128, 3))
)

base_model.trainable = False

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation="relu")(x)
x = Dropout(0.4)(x)
output = Dense(train_generator.num_classes, activation="softmax")(x)

model = Model(inputs=base_model.input, outputs=output)

model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)

model.summary()

callbacks = [
    EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True, verbose=1),
    ReduceLROnPlateau(monitor="val_loss", factor=0.3, patience=2, verbose=1),
    ModelCheckpoint(
        # Use H5 for the temporary checkpoint so it remains readable by the
        # native Windows TensorFlow 2.10 runtime. The final deployed model is
        # saved as .keras below.
        str(MODEL_DIR / "plant_disease_checkpoint.h5"),
        monitor="val_accuracy",
        mode="max",
        save_best_only=True,
        verbose=1,
    )
]

print("\nPhase 1: Training top layers...")
history = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=EPOCHS,
    callbacks=callbacks,
    verbose=1
)

print("\nPhase 2: Fine-tuning...")
base_model.trainable = True

for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=Adam(learning_rate=1e-5),
    loss="categorical_crossentropy",
    metrics=["accuracy"]
)

fine_tune_history = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=5,
    callbacks=callbacks,
    verbose=1
)

production_model_path = MODEL_DIR / "plant_disease_model.keras"
model.save(production_model_path)
print(f"\n✅ Model saved to models/plant_disease_model.keras")

with open(MODEL_DIR / "class_indices.json", "w") as f:
    json.dump(train_generator.class_indices, f, indent=4)
print(f"✅ Class indices saved to models/class_indices.json")

val_loss, val_acc = model.evaluate(val_generator, verbose=0)
print(f"\n✅ Final Validation Accuracy: {val_acc*100:.2f}%")

print("\n" + "="*50)
print("TRAINING COMPLETE!")
print("Now run: python app.py")
print("="*50)

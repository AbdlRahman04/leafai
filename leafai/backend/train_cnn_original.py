"""Original LeafAI CNN training run recovered from the editor's local history.

This is kept as a separate entry point so the recovered experiment can be run
without overwriting the path-safe/current trainer.
"""

import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D, Input
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from tensorflow.keras.optimizers import Adam
import json
import os

print("=" * 50)
print("TRAINING PLANT DISEASE MODEL (ORIGINAL RUN)")
print("=" * 50)

DATASET_DIR = "dataset/PlantVillage/color"
IMG_SIZE = (128, 128)
BATCH_SIZE = 32
EPOCHS = 10

os.makedirs("models", exist_ok=True)

if not os.path.exists(DATASET_DIR):
    print(f"ERROR: Dataset not found at {DATASET_DIR}")
    raise SystemExit(1)

class_folders = [
    folder
    for folder in os.listdir(DATASET_DIR)
    if os.path.isdir(os.path.join(DATASET_DIR, folder))
]
print(f"Found {len(class_folders)} disease classes")

if len(class_folders) < 2:
    print("ERROR: Need at least 2 classes for training")
    raise SystemExit(1)

train_datagen = ImageDataGenerator(
    rescale=1.0 / 255,
    validation_split=0.2,
    rotation_range=20,
    width_shift_range=0.15,
    height_shift_range=0.15,
    zoom_range=0.15,
    horizontal_flip=True,
    fill_mode="nearest",
)

val_datagen = ImageDataGenerator(rescale=1.0 / 255, validation_split=0.2)

train_generator = train_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    subset="training",
    shuffle=True,
)

val_generator = val_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    subset="validation",
    shuffle=False,
)

print(f"\nTraining samples: {train_generator.samples}")
print(f"Validation samples: {val_generator.samples}")
print(f"Number of classes: {train_generator.num_classes}")

base_model = MobileNetV2(
    weights="imagenet",
    include_top=False,
    input_tensor=Input(shape=(128, 128, 3)),
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
    metrics=["accuracy"],
)
model.summary()

callbacks = [
    EarlyStopping(
        monitor="val_loss", patience=4, restore_best_weights=True, verbose=1
    ),
    ReduceLROnPlateau(
        monitor="val_loss", factor=0.3, patience=2, verbose=1
    ),
    ModelCheckpoint(
        "models/plant_disease_model.keras",
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1,
    ),
]

print("\nPhase 1: Training top layers...")
model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=EPOCHS,
    callbacks=callbacks,
    verbose=1,
)

print("\nPhase 2: Fine-tuning...")
base_model.trainable = True
for layer in base_model.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=Adam(learning_rate=1e-5),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)
model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=5,
    callbacks=callbacks,
    verbose=1,
)

model.save("models/plant_disease_model.keras")
print("\nModel saved to models/plant_disease_model.keras")

with open("models/class_indices.json", "w") as file:
    json.dump(train_generator.class_indices, file, indent=4)
print("Class indices saved to models/class_indices.json")

val_loss, val_acc = model.evaluate(val_generator, verbose=0)
print(f"\nFinal Validation Accuracy: {val_acc * 100:.2f}%")
print("\n" + "=" * 50)
print("TRAINING COMPLETE!")
print("Now run: python app.py")
print("=" * 50)

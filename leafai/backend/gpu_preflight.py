"""Verify that the native Windows TensorFlow environment can use an NVIDIA GPU.

Run this from the Windows GPU environment before invoking ``train_cnn.py``.
The script intentionally does not import or alter the training code.
"""

from __future__ import annotations

import sys


def fail(message: str) -> None:
    print(f"GPU preflight failed: {message}", file=sys.stderr)
    print(
        "Use the native Windows GPU environment (.venv), run `nvidia-smi`, "
        "and review docs/ENVIRONMENT_SETUP.md.",
        file=sys.stderr,
    )
    raise SystemExit(1)


try:
    import tensorflow as tf
except Exception as error:  # pragma: no cover - only used during environment setup
    fail(f"TensorFlow could not be imported: {error}")


gpus = tf.config.list_physical_devices("GPU")
print(f"TensorFlow: {tf.__version__}")
print(f"Built with CUDA: {tf.test.is_built_with_cuda()}")
print(f"Physical GPUs: {gpus}")

if not gpus:
    fail("TensorFlow did not detect a GPU.")

try:
    with tf.device("/GPU:0"):
        result = tf.reduce_sum(tf.random.uniform((1024, 1024))).numpy()
        # Exercise the convolution path used by MobileNetV2. A reduction alone
        # can pass even when libcuda/cuDNN is missing.
        convolution = tf.keras.layers.Conv2D(8, 3, padding="same")(
            tf.random.uniform((1, 32, 32, 3))
        ).numpy()
except Exception as error:  # pragma: no cover - hardware/runtime dependent
    fail(f"TensorFlow detected a GPU but could not execute on it: {error}")

print(
    "GPU preflight passed. "
    f"Tensor result: {result:.6f}; convolution shape: {convolution.shape}"
)

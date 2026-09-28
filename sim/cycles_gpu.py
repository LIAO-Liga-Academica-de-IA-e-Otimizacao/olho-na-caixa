"""Select the NVIDIA GPU for Cycles. OptiX first, then CUDA."""

import bpy


def use_gpu(scene) -> str:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    scene.render.engine = "CYCLES"
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        names = [device.name for device in prefs.devices if device.type == backend]
        if not names:
            continue
        for device in prefs.devices:
            device.use = device.type == backend
        scene.cycles.device = "GPU"
        print(f"CYCLES_DEVICE {backend} {names[0]}")
        return f"{backend} {names[0]}"
    scene.cycles.device = "CPU"
    print("CYCLES_DEVICE CPU")
    return "CPU"

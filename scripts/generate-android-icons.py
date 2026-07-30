#!/usr/bin/env python3
"""Generate Android launcher icons from Flow's official 1024px artwork."""

from pathlib import Path
import hashlib
import sys

try:
    from PIL import Image, ImageDraw
except ImportError as error:
    raise SystemExit(
        "Pillow is required to regenerate Android icons. "
        "Install it with: python -m pip install Pillow"
    ) from error


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "mobile" / "flow-app-icon-1024.png"
RESOURCES = ROOT / "android" / "app" / "src" / "main" / "res"
EXPECTED_SOURCE_SHA256 = (
    "8118ad94559c50dd3be795cef7ac6a782ec90545c10f74863db11746e38b7eca"
)
BACKGROUND = (17, 17, 17)
LEGACY_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True, compress_level=9)


def round_icon(source: Image.Image, size: int) -> Image.Image:
    resized = source.resize((size, size), Image.Resampling.LANCZOS)
    scale = 4
    mask = Image.new("L", (size * scale, size * scale), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * scale - 1, size * scale - 1), fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    result = resized.copy()
    result.putalpha(mask)
    return result


def adaptive_foreground(source: Image.Image, size: int) -> Image.Image:
    # The official artwork includes a #111111 background. Keeping the complete
    # image over the identical adaptive background avoids edge seams and keeps
    # the white/lime wordmark unmodified. The 80% source canvas places the
    # artwork itself inside Android's central adaptive-icon safe zone.
    artwork_size = round(size * 0.80)
    artwork = source.resize(
        (artwork_size, artwork_size),
        Image.Resampling.LANCZOS,
    )
    result = Image.new("RGBA", (size, size), (*BACKGROUND, 0))
    inset = (size - artwork_size) // 2
    result.alpha_composite(artwork, (inset, inset))
    return result


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Official Flow icon is missing: {SOURCE}")

    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if source_hash != EXPECTED_SOURCE_SHA256:
        raise SystemExit(
            "Official Flow icon SHA-256 does not match the approved source. "
            f"Expected {EXPECTED_SOURCE_SHA256}, got {source_hash}."
        )

    with Image.open(SOURCE) as opened:
        opened.load()
        if opened.size != (1024, 1024):
            raise SystemExit(
                f"Official Flow icon must be 1024x1024, got {opened.size}."
            )
        source = opened.convert("RGBA")

    if source.getextrema()[3] != (255, 255):
        raise SystemExit("Official Flow icon must have an opaque background.")
    corners = {
        source.getpixel((0, 0))[:3],
        source.getpixel((1023, 0))[:3],
        source.getpixel((0, 1023))[:3],
        source.getpixel((1023, 1023))[:3],
    }
    if corners != {BACKGROUND}:
        raise SystemExit(
            f"Expected a solid #111111 source background, got corners {corners}."
        )

    for density, size in LEGACY_SIZES.items():
        output = RESOURCES / f"mipmap-{density}"
        legacy = source.resize((size, size), Image.Resampling.LANCZOS)
        save_png(legacy, output / "ic_launcher.png")
        save_png(round_icon(source, size), output / "ic_launcher_round.png")

    for density, size in FOREGROUND_SIZES.items():
        output = RESOURCES / f"mipmap-{density}"
        save_png(
            adaptive_foreground(source, size),
            output / "ic_launcher_foreground.png",
        )

    print(
        "Generated official Flow launcher icons for "
        f"{len(LEGACY_SIZES)} Android density buckets."
    )


if __name__ == "__main__":
    main()

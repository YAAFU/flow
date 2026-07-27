# Flow Android

The launcher artwork comes from the official iOS asset:

`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`

The approved 1024×1024 source is committed at:

`assets/mobile/flow-app-icon-1024.png`

Generated launcher resources live in `app/src/main/res/mipmap-*`. To regenerate
them, install Pillow and run:

```sh
python scripts/generate-android-icons.py
pnpm android:icons:validate
```

The normal Android build uses the committed resources and does not require the
iOS ZIP or Python.

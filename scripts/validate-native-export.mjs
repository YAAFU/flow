import path from "node:path";
import { validateNativeExport } from "./native-export-validator.mjs";

const exportRoot = path.resolve(process.cwd(), "out-native");
const result = await validateNativeExport(exportRoot);

if (!result.ok) {
  console.error("Native export validation failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Native export valid: ${result.checkedAssets} local asset references checked.`,
);

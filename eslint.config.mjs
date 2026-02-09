// // @ts-check

// import eslint from "@eslint/js";
// import tseslint from "typescript-eslint";
// import globals from "globals";

// export default tseslint.config(
//   eslint.configs.recommended,
//   ...tseslint.configs.recommendedTypeChecked,
//   ...tseslint.configs.stylisticTypeChecked,
//   {
//     rules: {
//       "@typescript-eslint/no-namespace": "off",
//       "@typescript-eslint/no-explicit-any": "off",
//     },
//     languageOptions: {
//       globals: {
//         ...globals.browser,
//         ...globals.node,
//       },
//       parserOptions: {
//         projectService: {
//           allowDefaultProject: ["*.js", "*.mjs"],
//         },
//         tsconfigRootDir: import.meta.dirname,
//       },
//     },
//   },
// );

// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);

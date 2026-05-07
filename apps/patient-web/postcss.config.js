import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

export default {
  plugins: {
    tailwindcss: { config: path.resolve(rootDir, 'tailwind.config.js') },
    autoprefixer: {},
  },
};

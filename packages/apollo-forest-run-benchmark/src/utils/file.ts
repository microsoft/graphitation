import fs from "fs";
import path from "path";

const RESULTS_DIR = "results";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");

export const saveResultFile = (name: string, data: string) => {
  const fileName = name.replace(/(\.[^.]*)?$/, `-${TIMESTAMP}$1`);

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(RESULTS_DIR, fileName), data);
};

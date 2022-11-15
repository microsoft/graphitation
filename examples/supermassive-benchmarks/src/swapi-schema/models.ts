import path from "path";
import { JsonDB } from "node-json-db";

export default new JsonDB(path.join(__dirname, "./starwars"));

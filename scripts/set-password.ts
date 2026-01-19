import "dotenv/config";
import bcrypt from "bcryptjs";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log("Uso: npm run set-password -- email@empresa.com senha123");
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 12);
  console.log("Cole isso na coluna passwordHash do usuário:");
  console.log(hash);
})();
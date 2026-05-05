import bcrypt from "bcrypt";

const password = "1234";

const generarHash = async () => {
  const hash = await bcrypt.hash(password, 10);
  console.log("HASH:", hash);
};

generarHash();
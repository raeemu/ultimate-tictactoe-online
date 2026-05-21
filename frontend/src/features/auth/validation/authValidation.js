export function validateLogin(username, password) {
  if (!username.trim() || !password) {
    return "Введите логин и пароль";
  }
  return null;
}

export function validateRegister(username, email, password, confirmPassword) {
  if (!username.trim() || !email.trim() || !password) {
    return "Для регистрации заполните логин, email и пароль";
  }
  if (password.length < 8) {
    return "Пароль должен быть не короче 8 символов";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Пароль должен содержать буквы и цифры";
  }
  if (password !== confirmPassword) {
    return "Пароли не совпадают";
  }
  return null;
}

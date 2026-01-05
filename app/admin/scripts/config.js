const API_URL = "https://plutarcoalmacen.com.ar/";
const TOKEN = localStorage.getItem("token");
const THEME = localStorage.getItem("theme");

const PREVIOUS_PAGE =
  localStorage.getItem("previous_page");

export default API_URL;
export { TOKEN, THEME, PREVIOUS_PAGE };

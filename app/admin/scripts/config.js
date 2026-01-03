const API_URL = "https://plutarcoalmacen.com.ar/";
const TOKEN = localStorage.getItem("token");
const THEME = localStorage.getItem("theme");

const PREVIOUS_PAGE =
  sessionStorage.getItem("previous_page") || "/productos/";

export default API_URL;
export { TOKEN, THEME, PREVIOUS_PAGE };

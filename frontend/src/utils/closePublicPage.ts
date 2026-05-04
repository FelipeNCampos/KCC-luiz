export function closePublicPage() {
  window.open("", "_self");
  window.close();
  window.location.replace("about:blank");
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".Polaris-TextField__Input");
  if (searchInput && !searchInput.value) {
    searchInput.value = "Draft Order Button";
    searchInput.dispatchEvent(new Event("input"));
    console.log("Search input set to Draft Order Button");
  } else {
    console.log("Search input not found or already filled:", searchInput?.value);
  }
});
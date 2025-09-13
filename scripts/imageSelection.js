// Makes the logo unselectable
window.onload = function() {
    document.body.onselectstart = function() {
        return false;
    }
}
var secret = lbl(true);
var result = 0;
if (secret) {
    result = 1; // Rejected: upgrading a public variable under secret control.
}
print(result); // Only diagnostic output: this program would not publish the value.

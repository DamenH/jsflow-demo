var secret = lbl(true);
var result = lbl(0); // Label the destination before branching.
if (secret) {
    result = 1;
}
print(result);
publicOutput('Computation completed');

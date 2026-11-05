var secret = lbl(41);
var result = secret + 1;
print(result); // Trusted diagnostic output: shows the secret label.
publicOutput('Computation completed'); // Public constant, outside secret control.

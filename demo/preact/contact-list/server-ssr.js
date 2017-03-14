let express = require('express');
let app = express();
const PORT = process.env.port || 3000;

app.use(express.static('.'));

app.listen(PORT, () => console.log(`Static server running on http://localhost:${PORT}/`));

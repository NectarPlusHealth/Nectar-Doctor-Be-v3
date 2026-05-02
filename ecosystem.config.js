module.exports = {
  apps: [
    {
      name: "doctor-backend",
      script: "dist/index.js",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
}

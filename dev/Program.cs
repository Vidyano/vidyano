Host.CreateDefaultBuilder(args)
    .ConfigureAppConfiguration((hostingContext, config) =>
    {
        var env = hostingContext.HostingEnvironment;

        config.AddJsonFile("appsettings.json", true, false)
            .AddJsonFile($"appsettings.{env.EnvironmentName}.json", true, false)
            .AddJsonFile("secrets/appsettings.secrets.json", true, false);

        config.AddEnvironmentVariables();

        if (env.IsDevelopment())
            config.AddUserSecrets<Program>();
    })
    .ConfigureWebHostDefaults(webBuilder => { webBuilder.UseStartup<Dev.Startup>(); })
    .Build().Run();
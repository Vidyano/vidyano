using Dev.Service;
using Dev.Service.Supervisor;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Vidyano.Service;
using Vidyano.Service.Repository.DataLayer;

namespace Dev;

public class Startup
{
    public Startup(IConfiguration configuration)
    {
        Configuration = configuration;
    }

    public IConfiguration Configuration { get; set; }

    // This method gets called by the runtime. Use this method to add services to the container.
    // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
    public void ConfigureServices(IServiceCollection services)
    {
        // Add CORS with no restrictions
        services.AddCors(options =>
        {
            options.AddPolicy("AllowAll",
                builder =>
                {
                    builder.AllowAnyOrigin()
                           .AllowAnyMethod()
                           .AllowAnyHeader();
                });
        });

        services.AddVidyanoNoDatabase(Configuration);
        services.Replace(new(typeof(IRepositoryUserStore), typeof(TestingJsonRepositoryUserStore), ServiceLifetime.Singleton));
        services.AddScoped<DevContext>();
        services.AddTransient<RequestScopeProvider<DevContext>>();
    }

    // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
    public void Configure(IApplicationBuilder app, IWebHostEnvironment env, IHostApplicationLifetime lifetime)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();

            // The dev supervisor runs the watchers and test runs; see /supervisor/
            lifetime.ApplicationStarted.Register(() =>
            {
                DevSupervisor.Start(Path.GetFullPath(Path.Combine(env.ContentRootPath, "..")));
                DevSupervisor.StopWithParent(lifetime.StopApplication);
            });
            lifetime.ApplicationStopping.Register(DevSupervisor.Stop);

            app.Use(async (context, next) =>
            {
                if (!await SupervisorApi.TryServe(context) && !await Worktrees.TryServe(context))
                    await next();
            });
        }

        // Enable CORS
        app.UseCors("AllowAll");

        app.UseVidyano(env, Configuration);
    }
}
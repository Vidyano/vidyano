#!/usr/bin/dotnet run
#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<ChartsContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(ChartsContext.Sales))
    .WithModel(b => b.GetOrCreatePersistentObject(nameof(Sale))));

var app = builder.Build();
app.UseVidyano(app.Environment, app.Configuration);
app.Run();

// === Context ===
public class ChartsContext : NullTargetContext
{
    private static readonly List<Sale> sales =
    [
        new Sale { Id = "1", Region = "North", Amount = 10 },
        new Sale { Id = "2", Region = "North", Amount = 20 },
        new Sale { Id = "3", Region = "South", Amount = 30 },
    ];

    public ChartsContext()
    {
        Register(sales);
    }

    public IQueryable<Sale> Sales => Query<Sale>();
}

public class Sale
{
    public string Id { get; set; } = string.Empty;
    public string Region { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class SaleActions(ChartsContext context)
    : PersistentObjectActions<ChartsContext, Sale>(context)
{
    public override void QueryExecuted(QueryExecutedArgs args)
    {
        base.QueryExecuted(args);

        if (args.Result != null)
            args.Result.Tag = "Sales";
    }

    // A text search shows the rows without charts
    protected override void OnChart(Source<Sale> source, ChartArgs args)
    {
        if (string.IsNullOrEmpty(args.Query.TextSearch))
            args.AddBarChart(source, "ByRegion", configure: chart => chart.GroupBy(s => s.Region).WithValues("Amount", s => s.Amount));
    }
}

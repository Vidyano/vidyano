#!/usr/bin/dotnet run
#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Articles))
    .WithModel(b =>
    {
        var po = b.GetOrCreatePersistentObject(nameof(Article));
    }));

var app = builder.Build();
app.UseVidyano(app.Environment, app.Configuration);
app.Run();

// === Context ===
public class MockContext : NullTargetContext
{
    private static readonly List<Article> articles =
    [
        new Article
        {
            Id = "1",
            Title = "First Article",
            Content = new string('A', 500),
            Summary = "Short summary"
        },
        new Article
        {
            Id = "2",
            Title = "Second Article",
            Content = string.Join(" ", Enumerable.Range(1, 100).Select(i => $"Word{i:D3}")),
            Summary = "Another summary"
        }
    ];

    public MockContext()
    {
        Register(articles);
    }

    public IQueryable<Article> Articles => Query<Article>();

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Article article)
            article.Id ??= Guid.NewGuid().ToString("N")[..8];
        base.AddObject(obj, entity);
    }
}

public class Article
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
}

public class ArticleActions(MockContext context)
    : PersistentObjectActions<MockContext, Article>(context)
{
}

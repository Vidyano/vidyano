#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*
#:package Bogus@35.*

using Bogus;
using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;
using Vidyano.Service.Repository.Builder;

Randomizer.Seed = new Random(8675309); // Deterministic seed for consistent bogus data

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano =>
{
    vidyano
        .WithUrls("http://localhost:44355")
        .WithDefaultAdmin()
        .WithSchemaRights()
        .WithMenuItem(nameof(MockContext.Attributes))
        .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject($"Mock.{nameof(Mock_Attribute)}");

            var referenceReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.ReferenceReadOnly));
            referenceReadOnly.IsReadOnly = true;

            var referenceSelectInPlace = po.GetOrCreateAttribute(nameof(Mock_Attribute.ReferenceSelectInPlace)) as PersistentObjectAttributeWithReferenceBuilder;
            referenceSelectInPlace.SelectInPlace = true;
        });
});

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];
    private static readonly List<Category> categories;

    static MockContext()
    {
        var categoryFaker = new Faker<Category>()
            .RuleFor(c => c.Id, f => f.IndexFaker.ToString())
            .RuleFor(c => c.Name, f => f.Commerce.Categories(1)[0]);

        categories = categoryFaker.Generate(5);

        // Ensure "Electronics" is always the first category for deterministic testing
        if (categories.Count > 0)
            categories[0].Name = "Electronics";
    }

    public MockContext()
    {
        Register(attributes);
        Register(categories);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();
    public IQueryable<Category> Categories => Query<Category>();

    public static List<Category> GetCategories() => categories;

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
            attributes.Add(attribute = new Mock_Attribute { Id = objectId });

        return attribute;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Attribute attribute)
            attribute.Id ??= (attributes.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb: CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Attribute>(context)
{
    public override Mock_Attribute? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    private static readonly string DefaultCategoryId = MockContext.GetCategories().First().Id;

    public string Id { get; set; } = null!;

    [Reference(typeof(Category))]
    public string Reference { get; set; } = DefaultCategoryId;

    [Reference(typeof(Category))]
    public string ReferenceReadOnly { get; set; } = DefaultCategoryId;

    [Reference(typeof(Category))]
    public string ReferenceSelectInPlace { get; set; } = DefaultCategoryId;

    [Reference(typeof(Category))]
    public string? NullableReference { get; set; } = null;
}

public class Category
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
}

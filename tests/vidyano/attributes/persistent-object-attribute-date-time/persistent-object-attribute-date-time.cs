#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using System.ComponentModel.DataAnnotations;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithUrls("http://localhost:44355")
    .WithDefaultAdmin()
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject($"Mock.{nameof(Mock_Attribute)}");

            var dateTimeReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.DateTimeReadOnly));
            dateTimeReadOnly.IsReadOnly = true;

            var dateTimeRequired = po.GetOrCreateAttribute(nameof(Mock_Attribute.DateTimeRequired));
            dateTimeRequired.AddRule("Required");

            var month = po.GetOrCreateAttribute(nameof(Mock_Attribute.Month));
            month.DataTypeHints = "displayformat={0:y}";

            var nullableMonth = po.GetOrCreateAttribute(nameof(Mock_Attribute.NullableMonth));
            nullableMonth.DataTypeHints = "displayformat={0:y}";

            var dateTimeMinMax = po.GetOrCreateAttribute(nameof(Mock_Attribute.DateTimeMinMax));
            dateTimeMinMax.DataTypeHints = "mindate=2024-01-01;maxdate=2024-12-31";
        })
    );

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
        {
            attribute = new Mock_Attribute
            {
                Id = objectId,
                DateTime = DateTime.Now,
                NullableDateTime = null,
                DateTimeReadOnly = DateTime.Now,
                DateTimeRequired = DateTime.Now,
                Month = DateTime.Now,
                NullableMonth = null,
                DateTimeMinMax = new DateTime(2024, 6, 15),
                Date = DateTime.Today,
                NullableDate = null,
            };
            attributes.Add(attribute);
        }

        return attribute;
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, object>(context)
{
    public override object? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    public DateTime DateTime { get; set; }

    public DateTime? NullableDateTime { get; set; }

    public DateTime DateTimeReadOnly { get; set; }

    public DateTime DateTimeRequired { get; set; }

    [DataType(DataTypes.Date)]
    public DateTime Month { get; set; }

    [DataType(DataTypes.NullableDate)]
    public DateTime? NullableMonth { get; set; }

    public DateTime DateTimeMinMax { get; set; }

    public DateTime Date { get; set; }

    public DateTime? NullableDate { get; set; }
}

require 'spec_helper'
require_relative '../lodqa'

enjuURL = "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"
ontofinderURL = "http://ontofinder.dbcls.jp/mappings.json"

describe "LODQA", "error-handling in initialization method" do
  it "should handle bad enju url" do
    expect { SparqlGenerator.new("http://bionlp.dbcls.jp/enjuuuu", ontofinderURL, "semanticTypes.xml") }.to raise_error
  end
  it "should handle bad ontofind url" do
    expect { SparqlGenerator.new(enjuURL, "http://ontofinder.dbcls.jpppp", "semanticTypes.xml") }.to raise_error
  end  
  it "should handle bad tuilookup xml file name" do
    expect { SparqlGenerator.new(enjuURL, ontofinderURL, "semanticTypes.xmllll") }.to raise_error
  end
end

describe "LODQA", "error-handling on configuration" do
  it "should be able to handle a missing config file"
end

describe "LODQA", "error-handling in nlq2sparql method" do
  before do
    @g = SparqlGenerator.new(enjuURL, ontofinderURL, "semanticTypes.xml")
  end

  it "should handle empty query" do
    expect { @g.nlq2sparql("", 1348, "OMIM") }.to raise_error
  end 

  it "should handle null query" do
    expect { @g.nlq2sparql(nil, 1348, "OMIM") }.to raise_error
  end
end

describe "LODQA", "error-handling in get_query_annotation method" do
  it "should handle case where there are no base noun chunks" do
  # no need to check any return values here--we're just checking to see
  # that it doesn't crash in this case.
  # note that we picked the methods to call by taking a subset of the
  # ones that get called in lodqaWS.rb.
    g = SparqlGenerator.new(enjuURL, ontofinderURL, "semanticTypes.xml")
    q = g.nlq2sparql("big", 1348, "OMIM")
  end
end

# describe "LODQA", "error-handling in get_bncs method" do
#   it "should handle case where there are no base noun chunks"
#   # no need to check any return values here--we're just checking to see
#   # that it doesn't crash in this case.
#   # note that we picked the methods to call by taking a subset of the
#   # ones that get called in lodqaWS.rb.
#     qp = SparqlGenerator.new(enjuURL, ontofinderURL, "semanticTypes.xml")
#     qp.parse("big")
#     qp.get_bncs
# end

# describe "LODQA", "error-handling in get_texps method" do
#   it "should handle case where there is no content for the texps variable" 
# end

# describe "LODQA", "error-handling in get_psparql method" do
#   it "should handle case where some of this has no content, but I'm not sure what yet" do
#     qp = SparqlGenerator.new(enjuURL, ontofinderURL, "semanticTypes.xml")
#     qp.parse("What devices are used to treat heart failure?")
#     qp.get_psparql.should eql ("SELECT ?t1\nWHERE {\n   ?t1 [:isa] [devices] . \n   ?t2 [:isa] [heart failure] . \n   ?t1 [used to treat] ?t2 . \n}") 
#   end
# end

# describe "LODQA", "error-handling in get_sparql method" do
#   it "should handle null vid"
#   it "should handle empty vid"
#   it "should handle invalid vid"
#   it "should handle null acronym"
#   it "should handle empty acronym"
# end

# describe "LODQA", "error-handling in find_term_uris method" do
#   it "should handle null vid"
#   it "should handle empty vid"
#   it "should handle invalid vid"
# end

# describe "LODQA", "error-handling when using the command line" do
#   it "should handle a missing semantic types file"
# end

# describe "LODQA", "basic functionality testing" do
#   it "should handle good inputs when initialized"
#   it "should handle valid queries to parser"
#   it "should be able to look up existent terms given a good vid"
#   it "should be able to take valid arguments from the command line"
#   it "should be able to handle empty argument list from the command line"
#   it "should handle a query that contains the word 'me'"
#   it "should handle a query that does not contain the word 'me'" 
# end

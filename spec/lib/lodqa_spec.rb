require 'spec_helper'

enjuURL = "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"
dictionaryURL = "http://pubdictionaries.dbcls.jp:80/dictionaries/text_annotation?dictionaries=%5B%22OMIM%22%2C%22UMLS-TUI-URI%22%5D&matching_method=approximate&max_tokens=6&min_tokens=1&threshold=0.6&top_n=0"
query = "what genes are associated with alzheimer disease?"
oId = 1348
oAcronym = "OMIM"

describe "QueryParse", "error-handling in initialization method" do
  before do
    @enju_accessor       = RestClient::Resource.new enju_url
    @dictionary_accessor = RestClient::Resource.new dictionary_url
    @query_parse         = QueryParse.new(@enju_accessor, @dictionary_accessor, query, oId, oAcronym)
  end
end

describe "LODQA", "error-handling on configuration" do
  it "should be able to handle a missing config file"
end

# describe "LODQA", "error-handling in get_texps method" do
#   it "should handle case where there is no content for the texps variable" 
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
